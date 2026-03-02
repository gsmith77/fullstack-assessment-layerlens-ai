import { memo, useState } from "react";

import { Paper, Typography, Box, Stack, TextField, Alert, Button } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createJob } from "@/utils/mutations";
import { CreateJobRequest, JobType } from "@/utils/interfaces";

const JOB_TYPES: JobType[] = ["process", "analyze", "export"];

type CreateFormProps = {
    setShowCreateForm: (val: boolean) => void;
}

const CreateFormComponent = ({ setShowCreateForm }: CreateFormProps) => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<CreateJobRequest>({
      name: "",
      job_type: "process",
      config: {},
    });
    const [configJson, setConfigJson] = useState("{}");

    const [error, setError] = useState<string | null>(null);

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

  return (
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
          />
          <TextField
            id="job_type"
            label={`Job Type * (valid job types: ${JOB_TYPES.join(', ')})`}
            value={formData.job_type}
            onChange={(e) =>
              setFormData({ ...formData, job_type: e.target.value })
            }
            placeholder="Enter job name"
            fullWidth
          />
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
  )
}

export const CreateForm = memo(CreateFormComponent)
