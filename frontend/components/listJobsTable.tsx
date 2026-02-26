import { useState } from "react"

import { Job, JobStatus, canBeCancelled, canBeRetried, hasActiveJobs } from "@/utils/interfaces"
import { cancelJob, retryJob } from "@/utils/mutations"
import { queryKeys, fetchJobs } from "@/utils/queries"
import { Paper, Box, Typography, CircularProgress, Alert, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, Button, TablePagination } from "@mui/material"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"

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

export const ListJobsTable = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.jobs(page, ROWS_PER_PAGE),
    queryFn: () => fetchJobs(page, ROWS_PER_PAGE),
    // Real-time updates: poll every 2s while any job on this page is active
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      return hasActiveJobs(jobs) ? 2000 : false;
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

  const handleTablePageChange = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage + 1);
  };

  const totalCount = data?.total ?? 0;

  return (
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
  )
};
