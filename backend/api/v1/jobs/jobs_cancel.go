package jobs

import (
	"errors"
	"net/http"

	"github.com/fullstack-assessment/backend/api/shared"
	"github.com/fullstack-assessment/backend/services"
	"github.com/gorilla/mux"
)

// cancelJob handles POST /api/v1/jobs/{id}/cancel
// NOTE: This is a skeleton - candidate should implement the service method
func (h *Handler) cancelJob(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if id == "" {
		shared.RespondErrorMessage(w, http.StatusBadRequest, "job ID is required")
		return
	}

	job, err := h.service.CancelJob(r.Context(), id)
	if err != nil {
		// TODO: Candidate should add proper error handling here => DONE
		// - 404 for job not found
		if errors.Is(err, services.ErrJobNotFound) {
			shared.RespondErrorMessage(w, http.StatusNotFound, "job not found")
			return
		}
		// - 409 for job that cannot be cancelled (wrong state)
		if errors.Is(err, services.ErrInvalidJobState) {
			shared.RespondErrorMessage(w, http.StatusConflict, "job cannot be cancelled in its current state")
			return
		}
		// - 500 for internal errors
		shared.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	shared.RespondJSON(w, http.StatusOK, job)
}

// retryJob handles POST /api/v1/jobs/{id}/retry
// NOTE: This is a skeleton - candidate should implement the service method
func (h *Handler) retryJob(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if id == "" {
		shared.RespondErrorMessage(w, http.StatusBadRequest, "job ID is required")
		return
	}

	job, err := h.service.RetryJob(r.Context(), id)
	if err != nil {
		if errors.Is(err, services.ErrJobNotFound) {
			shared.RespondErrorMessage(w, http.StatusNotFound, "job not found")
			return
		}
		if errors.Is(err, services.ErrInvalidJobState) || errors.Is(err, services.ErrMaxRetriesReached) {
			shared.RespondErrorMessage(w, http.StatusConflict, err.Error())
			return
		}
		shared.RespondError(w, http.StatusInternalServerError, err)
		return
	}

	shared.RespondJSON(w, http.StatusOK, job)
}
