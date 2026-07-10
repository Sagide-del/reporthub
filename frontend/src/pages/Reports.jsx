import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';

const Reports = () => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Reports
        </Typography>
        <Button variant="contained" startIcon={<UploadIcon />}>
          Import CSV
        </Button>
      </Box>
      <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Report generation coming soon. Import student results to generate report cards.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Reports;