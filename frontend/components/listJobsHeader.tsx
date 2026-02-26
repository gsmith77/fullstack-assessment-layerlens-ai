import { memo } from "react";

import { Stack, Box, Typography, Button } from "@mui/material"

type ListJobsHeaderProps = {
    showCreateForm: boolean;
    setShowCreateForm: (val: boolean) => void;
}

const ListJobsHeaderComponent = ({ showCreateForm, setShowCreateForm }: ListJobsHeaderProps) => (
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
);

export const ListJobsHeader = memo(ListJobsHeaderComponent);
