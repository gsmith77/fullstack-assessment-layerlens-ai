"use client";

import { useState } from "react";

import { Box } from "@mui/material";
import { CreateForm, ListJobsHeader, ListJobsTable } from "@/components";

export default function Home() {
  const [showCreateForm, setShowCreateForm] = useState(false);

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
        <ListJobsHeader showCreateForm={showCreateForm} setShowCreateForm={setShowCreateForm} />

        {showCreateForm && <CreateForm setShowCreateForm={setShowCreateForm} />}

        <ListJobsTable />
      </Box>
    </Box>
  );
}
