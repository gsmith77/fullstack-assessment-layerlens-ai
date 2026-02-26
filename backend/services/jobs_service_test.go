package services

// Unit tests for jobs_service.go per README Task 3.
//
// CreateJob: valid input creates job; invalid job_type returns error; missing name returns error.
// GetJob: existing job returned; non-existent returns not-found error.
// CancelJob: valid cancellation works; cancelling completed returns error; cancelling non-existent returns error.
//
// Requirements: mock JobsRepository and KafkaProducer; table-driven tests; verify correct Kafka message for cancellations.
import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/fullstack-assessment/backend/models"
	"github.com/fullstack-assessment/backend/repositories"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// mockJobsRepo is a mock implementation of JobsRepository
type mockJobsRepo struct {
	createErr              error
	getByIDResult          *models.Job
	getByIDErr             error
	listResult             []models.Job
	listTotal              int64
	listErr                error
	updateStatusErr        error
	updateStatusWithRetryErr error
	updateErr              error

	// capture what was passed to Create (so we can assert job fields)
	createdJob *models.Job
	// capture UpdateStatus args
	updateStatusID     string
	updateStatusStatus models.JobStatus
	// capture GetByID calls
	getByIDIDs []string
}

func (m *mockJobsRepo) Create(ctx context.Context, job *models.Job) error {
	m.createdJob = job
	if job != nil {
		// Simulate repo setting ID and timestamps (like real repo)
		job.ID = primitive.NewObjectID()
		job.CreatedAt = time.Now()
		job.UpdatedAt = time.Now()
	}
	return m.createErr
}

func (m *mockJobsRepo) GetByID(ctx context.Context, id string) (*models.Job, error) {
	m.getByIDIDs = append(m.getByIDIDs, id)
	if m.getByIDErr != nil {
		return nil, m.getByIDErr
	}
	return m.getByIDResult, nil
}

func (m *mockJobsRepo) List(ctx context.Context, page, limit int) ([]models.Job, int64, error) {
	return m.listResult, m.listTotal, m.listErr
}

func (m *mockJobsRepo) UpdateStatus(ctx context.Context, id string, status models.JobStatus) error {
	m.updateStatusID = id
	m.updateStatusStatus = status
	return m.updateStatusErr
}

func (m *mockJobsRepo) UpdateStatusWithRetry(ctx context.Context, id string, status models.JobStatus, retryCount int) error {
	return m.updateStatusWithRetryErr
}

func (m *mockJobsRepo) Update(ctx context.Context, job *models.Job) error {
	return m.updateErr
}

// mockKafkaProducer records Publish calls for verification
type mockKafkaProducer struct {
	publishErr error
	calls      []struct {
		topic   string
		message interface{}
	}
}

func (m *mockKafkaProducer) Publish(ctx context.Context, topic string, message interface{}) error {
	m.calls = append(m.calls, struct {
		topic   string
		message interface{}
	}{topic, message})
	return m.publishErr
}

func TestCreateJob(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name        string
		req         CreateJobRequest
		repoSetup   func() *mockJobsRepo
		producer    *mockKafkaProducer
		wantErr     bool
		validateErr func(t *testing.T, err error)
		validateJob func(t *testing.T, job *models.Job)
	}{
		{
			name: "valid input creates a job successfully",
			req: CreateJobRequest{
				Name:    "My Job",
				JobType: "process",
				Config:  map[string]interface{}{"key": "value"},
			},
			repoSetup: func() *mockJobsRepo { return &mockJobsRepo{} },
			producer:  &mockKafkaProducer{},
			wantErr:   false,
			validateJob: func(t *testing.T, job *models.Job) {
				if job == nil {
					t.Fatal("expected non-nil job")
				}
				if job.Name != "My Job" {
					t.Errorf("job.Name = %q, want %q", job.Name, "My Job")
				}
				if job.JobType != models.JobTypeProcess {
					t.Errorf("job.JobType = %q, want process", job.JobType)
				}
				if job.Status != models.JobStatusPending {
					t.Errorf("job.Status = %q, want pending", job.Status)
				}
				if job.RetryCount != 0 {
					t.Errorf("job.RetryCount = %d, want 0", job.RetryCount)
				}
			},
		},
		{
			name: "invalid job_type returns an error",
			req: CreateJobRequest{
				Name:    "My Job",
				JobType: "invalid_type",
			},
			repoSetup: func() *mockJobsRepo { return &mockJobsRepo{} },
			producer:  &mockKafkaProducer{},
			wantErr:   true,
			validateErr: func(t *testing.T, err error) {
				if !IsValidationError(err) {
					t.Errorf("expected ValidationError, got %T", err)
				}
				if err != nil && err.Error() != "job_type: invalid job type 'invalid_type', must be one of: process, analyze, export" {
					t.Errorf("unexpected error: %v", err)
				}
			},
		},
		{
			name: "missing required field name returns an error",
			req: CreateJobRequest{
				Name:    "",
				JobType: "analyze",
			},
			repoSetup: func() *mockJobsRepo { return &mockJobsRepo{} },
			producer:  &mockKafkaProducer{},
			wantErr:   true,
			validateErr: func(t *testing.T, err error) {
				if !IsValidationError(err) {
					t.Errorf("expected ValidationError, got %T", err)
				}
				if err != nil && err.Error() != "name: job name is required" {
					t.Errorf("unexpected error: %v", err)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := tt.repoSetup()
			svc := NewJobsService(repo, tt.producer)
			job, err := svc.CreateJob(ctx, tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateJob() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.validateErr != nil {
				tt.validateErr(t, err)
			}
			if !tt.wantErr && tt.validateJob != nil {
				tt.validateJob(t, job)
			}
		})
	}
}

func TestGetJob(t *testing.T) {
	ctx := context.Background()
	oid := primitive.NewObjectID()
	existingJob := &models.Job{
		ID:        oid,
		Name:      "Test Job",
		JobType:   models.JobTypeExport,
		Status:    models.JobStatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	tests := []struct {
		name        string
		id          string
		repoJob     *models.Job
		repoErr     error
		wantErr     bool
		wantNotFound bool
		validateJob func(t *testing.T, job *models.Job)
	}{
		{
			name:    "existing job is returned",
			id:      oid.Hex(),
			repoJob: existingJob,
			repoErr: nil,
			wantErr: false,
			validateJob: func(t *testing.T, job *models.Job) {
				if job == nil {
					t.Fatal("expected non-nil job")
				}
				if job.ID != oid {
					t.Errorf("job.ID mismatch")
				}
				if job.Name != "Test Job" {
					t.Errorf("job.Name = %q, want Test Job", job.Name)
				}
			},
		},
		{
			name:         "non-existent job returns a not-found error",
			id:           primitive.NewObjectID().Hex(),
			repoJob:      nil,
			repoErr:      nil,
			wantErr:      true,
			wantNotFound: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &mockJobsRepo{getByIDResult: tt.repoJob, getByIDErr: tt.repoErr}
			svc := NewJobsService(repo, &mockKafkaProducer{})
			job, err := svc.GetJob(ctx, tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetJob() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.wantNotFound && !errors.Is(err, ErrJobNotFound) {
				t.Errorf("expected ErrJobNotFound, got %v", err)
			}
			if !tt.wantErr && tt.validateJob != nil {
				tt.validateJob(t, job)
			}
		})
	}
}

func TestCancelJob(t *testing.T) {
	ctx := context.Background()
	pendingID := primitive.NewObjectID()
	completedID := primitive.NewObjectID()
	nonExistentID := primitive.NewObjectID()
	pendingJob := &models.Job{ID: pendingID, Name: "J", JobType: models.JobTypeProcess, Status: models.JobStatusPending}
	updatedJob := &models.Job{ID: pendingID, Name: "J", Status: models.JobStatusCancelling}

	tests := []struct {
		name                    string
		id                      string
		repo                    repositories.JobsRepository
		producer                 *mockKafkaProducer
		wantErr                  bool
		wantErrIs                error
		validateCancelMessage    func(t *testing.T, producer *mockKafkaProducer, jobID string)
	}{
		{
			name:    "valid cancellation works",
			id:      pendingID.Hex(),
			repo: &multiGetMockRepo{
				getByIDResults: []getByIDResult{
					{job: pendingJob, err: nil},
					{job: updatedJob, err: nil},
				},
			},
			producer: &mockKafkaProducer{},
			wantErr:  false,
			validateCancelMessage: func(t *testing.T, producer *mockKafkaProducer, jobID string) {
				// Requirement: Verify the correct Kafka message is published for cancellations.
				if len(producer.calls) != 1 {
					t.Errorf("expected exactly 1 Publish call for cancellation, got %d", len(producer.calls))
					return
				}
				c := producer.calls[0]
				if c.topic != "job_cancellations" {
					t.Errorf("Publish topic = %q, want job_cancellations", c.topic)
				}
				msg, ok := c.message.(CancellationMessage)
				if !ok {
					t.Errorf("expected CancellationMessage, got %T", c.message)
					return
				}
				if msg.JobID != jobID {
					t.Errorf("CancellationMessage.JobID = %q, want %q", msg.JobID, jobID)
				}
				if msg.CancelledAt.IsZero() {
					t.Error("CancellationMessage.CancelledAt must be set")
				}
			},
		},
		{
			name:     "cancelling a completed job returns an error",
			id:       completedID.Hex(),
			repo:     &mockJobsRepo{getByIDResult: &models.Job{ID: completedID, Name: "J", Status: models.JobStatusCompleted}, getByIDErr: nil},
			producer: &mockKafkaProducer{},
			wantErr:   true,
			wantErrIs: ErrInvalidJobState,
		},
		{
			name:     "cancelling a non-existent job returns an error",
			id:       nonExistentID.Hex(),
			repo:     &mockJobsRepo{getByIDResult: nil, getByIDErr: nil},
			producer: &mockKafkaProducer{},
			wantErr:   true,
			wantErrIs: ErrJobNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewJobsService(tt.repo, tt.producer)
			job, err := svc.CancelJob(ctx, tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("CancelJob() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
				t.Errorf("CancelJob() error = %v, want errors.Is(..., %v)", err, tt.wantErrIs)
			}
			if !tt.wantErr && tt.validateCancelMessage != nil {
				tt.validateCancelMessage(t, tt.producer, tt.id)
			}
			_ = job
		})
	}
}

// multiGetMockRepo returns different (job, err) on each GetByID call (for CancelJob: first = pending job, second = updated job).
type multiGetMockRepo struct {
	getByIDResults   []getByIDResult
	getByIDIndex     int
	updateStatusErr  error
	updateStatusID   string
	updateStatusStatus models.JobStatus
}

type getByIDResult struct {
	job *models.Job
	err error
}

func (m *multiGetMockRepo) Create(ctx context.Context, job *models.Job) error { return nil }
func (m *multiGetMockRepo) List(ctx context.Context, page, limit int) ([]models.Job, int64, error) {
	return nil, 0, nil
}
func (m *multiGetMockRepo) UpdateStatusWithRetry(ctx context.Context, id string, status models.JobStatus, retryCount int) error {
	return nil
}
func (m *multiGetMockRepo) Update(ctx context.Context, job *models.Job) error { return nil }

func (m *multiGetMockRepo) GetByID(ctx context.Context, id string) (*models.Job, error) {
	if m.getByIDIndex >= len(m.getByIDResults) {
		return nil, nil
	}
	res := m.getByIDResults[m.getByIDIndex]
	m.getByIDIndex++
	return res.job, res.err
}

func (m *multiGetMockRepo) UpdateStatus(ctx context.Context, id string, status models.JobStatus) error {
	m.updateStatusID = id
	m.updateStatusStatus = status
	return m.updateStatusErr
}
