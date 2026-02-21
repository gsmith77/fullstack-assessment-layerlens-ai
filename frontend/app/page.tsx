"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJobs, queryKeys } from "@/utils/queries";
import { createJob, cancelJob, retryJob } from "@/utils/mutations";
import {
  Job,
  JobType,
  JobStatus,
  CreateJobRequest,
  canBeCancelled,
  canBeRetried,
} from "@/utils/interfaces";

import {
  Box,
  Button,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Alert,
  CircularProgress,
  Stack
} from "@mui/material";

const JOB_TYPES: JobType[] = ["process", "analyze", "export"];

const ROWS_PER_PAGE = 10;

const STATUS_CHIP_COLOR: Record<
  JobStatus,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  pending: "warning",
  processing: "info",
  completed: "success",
  failed: "error",
  cancelling: "warning",
  cancelled: "default",
};

export default function Home() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateJobRequest>({
    name: "",
    job_type: "process",
    config: {},
  });
  const [configJson, setConfigJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.jobs(page, ROWS_PER_PAGE),
    queryFn: () => fetchJobs(page, ROWS_PER_PAGE),
  });

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowCreateForm(false);
      setFormData({ name: "", job_type: "process", config: {} });
      setConfigJson("{}");
      setError(null);
    },
    onError: (err: unknown & { response?: { data?: { error?: string } } }) => {
      const errorMessage = err?.response?.data?.error || "Failed to create job";
      setError(errorMessage);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let config: Record<string, unknown> = {};
    const trimmed = configJson.trim();
    if (trimmed) {
      try {
        config = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        setError("Config must be valid JSON");
        return;
      }
    }
    createMutation.mutate({ ...formData, config });
  };

  const handleTablePageChange = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage + 1);
  };

  const totalCount = data?.total ?? 0;

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        py: 3,
        px: 2,
        bgcolor: "grey.100",
      }}
    >
      <Box sx={{ maxWidth: 960, mx: "auto" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          mb={3}
        >
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold" color="text.primary">
              Job Processing System
            </Typography>
            <Typography variant="body1" color="text.secondary" mt={0.5}>
              Manage and monitor your processing jobs
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => setShowCreateForm(!showCreateForm)}
            sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
          >
            {showCreateForm ? "Cancel" : "Create Job"}
          </Button>
        </Stack>

        {showCreateForm && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Create New Job
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  id="name"
                  label="Job Name *"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter job name"
                  fullWidth
                  required
                />
                <FormControl fullWidth required>
                  <InputLabel id="job_type-label">Job Type *</InputLabel>
                  <Select
                    labelId="job_type-label"
                    id="job_type"
                    value={formData.job_type}
                    label="Job Type *"
                    onChange={(e) =>
                      setFormData({ ...formData, job_type: e.target.value })
                    }
                  >
                    {JOB_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  id="config"
                  label="Config (JSON)"
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  placeholder='{"key": "value"}'
                  multiline
                  rows={4}
                  fullWidth
                  helperText='Optional. Record of key-value pairs as JSON (e.g. {"key": "value"})'
                  sx={{ "& .MuiInputBase-input": { fontFamily: "monospace" } }}
                />
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
                <Stack direction="row" spacing={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create Job"}
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      setShowCreateForm(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Paper>
        )}

        <Paper>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" component="h2">
              Jobs
            </Typography>
            <Button size="small" onClick={() => refetch()} color="primary">
              Refresh
            </Button>
          </Box>

          {isLoading && (
            <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          )}

          {isError && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Alert severity="error">
                Failed to load jobs. Please try again.
              </Alert>
            </Box>
          )}

          {data && !data.jobs?.length && !isLoading && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography color="text.secondary">
                No jobs found. Create your first job to get started.
              </Typography>
            </Box>
          )}

          {data && data.jobs?.length && !isLoading && (
            <>
              <TableContainer>
                <Table size="medium">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Retries</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.jobs.map((job: Job) => (
                      <TableRow key={job.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {job.name}
                        </TableCell>
                        <TableCell sx={{ textTransform: "capitalize" }}>
                          {job.jobType}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={job.status}
                            color={STATUS_CHIP_COLOR[job.status]}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(job.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{job.retryCount}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {canBeCancelled(job) && (
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => cancelMutation.mutate(job.id)}
                                disabled={
                                  cancelMutation.isPending &&
                                  cancelMutation.variables === job.id
                                }
                              >
                                {cancelMutation.isPending &&
                                cancelMutation.variables === job.id
                                  ? "Cancelling..."
                                  : "Cancel"}
                              </Button>
                            )}
                            {canBeRetried(job) && (
                              <Button
                                size="small"
                                color="primary"
                                variant="outlined"
                                onClick={() => retryMutation.mutate(job.id)}
                                disabled={
                                  retryMutation.isPending &&
                                  retryMutation.variables === job.id
                                }
                              >
                                {retryMutation.isPending &&
                                retryMutation.variables === job.id
                                  ? "Retrying..."
                                  : `Retry (${job.retryCount}/3)`}
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalCount}
                page={page - 1}
                onPageChange={handleTablePageChange}
                rowsPerPage={ROWS_PER_PAGE}
                rowsPerPageOptions={[ROWS_PER_PAGE]}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
                }
              />
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
