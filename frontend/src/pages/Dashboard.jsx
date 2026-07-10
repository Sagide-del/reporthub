import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Newspaper as NewspaperIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // Get school info from localStorage
  const schoolData = JSON.parse(localStorage.getItem('school') || '{}');
  
  const stats = [
    { title: 'Total Students', value: '0', icon: <PeopleIcon />, color: '#1a237e' },
    { title: 'Reports', value: '0', icon: <ReceiptIcon />, color: '#0d47a1' },
    { title: 'Newsletters', value: '0', icon: <NewspaperIcon />, color: '#004d40' },
    { title: 'Average Score', value: '0%', icon: <TrendingUpIcon />, color: '#1b5e20' },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Welcome back, {schoolData.schoolName || 'School'}!
      </Typography>

      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 3,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' },
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stat.value}
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: stat.color + '20',
                  color: stat.color,
                  borderRadius: '50%',
                  p: 1.5,
                  display: 'flex',
                }}
              >
                {stat.icon}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate('/students')}
                  sx={{ py: 2, borderRadius: 2, textTransform: 'none' }}
                >
                  Manage Students
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  onClick={() => navigate('/reports')}
                  sx={{ py: 2, borderRadius: 2, textTransform: 'none' }}
                >
                  Generate Reports
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/newsletters')}
                  sx={{ py: 2, borderRadius: 2, textTransform: 'none' }}
                >
                  Newsletters
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/recommendations')}
                  sx={{ py: 2, borderRadius: 2, textTransform: 'none' }}
                >
                  Recommendations
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              School Information
            </Typography>
            <Box>
              <Typography variant="body2" color="text.secondary">
                <strong>Name:</strong> {schoolData.schoolName || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <strong>Email:</strong> {schoolData.email || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <strong>Phone:</strong> {schoolData.phone || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <strong>Subscription:</strong> {schoolData.subscription?.status || 'Pending'}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;