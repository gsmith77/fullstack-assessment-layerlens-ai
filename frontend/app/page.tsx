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

const JOB_TYPES: JobType[] = ["process", "analyze", "export"];

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelling: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-800",
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
    queryKey: queryKeys.jobs(page, 10),
    queryFn: () => fetchJobs(page, 10),
  });

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowCreateForm(false);
      console.log("success");
      setFormData({ name: "", job_type: "process", config: {} });
      setConfigJson("{}");
      setError(null);
    },
    onError: (err: any) => {
      const errorMessage = err?.response?.data?.error || "Failed to create job";
      console.log("err", errorMessage);
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
    createMutation.mutateAsync({ ...formData, config });
  };

  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Job Processing System
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and monitor your processing jobs
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {showCreateForm ? "Cancel" : "Create Job"}
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New Job</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Job Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter job name"
                />
              </div>

              <div>
                <label
                  htmlFor="job_type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Job Type *
                </label>
                <select
                  id="job_type"
                  value={formData.job_type}
                  onChange={(e) =>
                    setFormData({ ...formData, job_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {JOB_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="config"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Config (JSON)
                </label>
                <textarea
                  id="config"
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
                <p className="mt-1 text-xs text-gray-500">
                  Optional. Record of key-value pairs as JSON (e.g. {'{"key": "value"}'})
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
                >
                  {createMutation.isPending ? "Creating..." : "Create Job"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Jobs</h2>
            <button
              onClick={() => refetch()}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh
            </button>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-gray-500">Loading jobs...</div>
          )}

          {isError && (
            <div className="p-8 text-center text-red-500">
              Failed to load jobs. Please try again.
            </div>
          )}

          {data && !data.jobs?.length && (
            <div className="p-8 text-center text-gray-500">
              No jobs found. Create your first job to get started.
            </div>
          )}

          {data && data.jobs?.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Retries
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.jobs.map((job: Job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {job.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                          {job.jobType}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[job.status]}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {job.retryCount}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canBeCancelled(job) && (
                              <button
                                type="button"
                                onClick={() => cancelMutation.mutate(job.id)}
                                disabled={
                                  cancelMutation.isPending &&
                                  cancelMutation.variables === job.id
                                }
                                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {cancelMutation.isPending &&
                                cancelMutation.variables === job.id
                                  ? "Cancelling..."
                                  : "Cancel"}
                              </button>
                            )}
                            {canBeRetried(job) && (
                              <button
                                type="button"
                                onClick={() => retryMutation.mutate(job.id)}
                                disabled={
                                  retryMutation.isPending &&
                                  retryMutation.variables === job.id
                                }
                                className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {retryMutation.isPending &&
                                retryMutation.variables === job.id
                                  ? "Retrying..."
                                  : `Retry (${job.retryCount}/3)`}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages} ({data.total} total jobs)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
