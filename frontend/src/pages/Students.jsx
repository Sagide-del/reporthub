import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const Students = () => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Students
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Student
        </Button>
      </Box>
      <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Student management coming soon. Import your students from CSV or add them manually.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Students;