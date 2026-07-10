import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Avatar,
  LinearProgress,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Newspaper as NewspaperIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { school } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalReports: 0,
    totalNewsletters: 0,
    averageScore: 0,
  });
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const studentsRes = await api.get('/students');
      setStudents(studentsRes.data);
      
      const total = studentsRes.data.length;
      const avgScore = studentsRes.data.reduce((sum, s) => sum + (s.results?.averageScore || 0), 0) / (total || 1);
      
      setStats({
        totalStudents: total,
        totalReports: total,
        totalNewsletters: 3,
        averageScore: Math.round(avgScore),
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: <PeopleIcon />,
      color: '#1a237e',
      bgColor: '#e8eaf6',
    },
    {
      title: 'Reports Generated',
      value: stats.totalReports,
      icon: <ReceiptIcon />,
      color: '#0d47a1',
      bgColor: '#e3f2fd',
    },
    {
      title: 'Newsletters',
      value: stats.totalNewsletters,
      icon: <NewspaperIcon />,
      color: '#004d40',
      bgColor: '#e0f2f1',
    },
    {
      title: 'Average Score',
      value: `${stats.averageScore}%`,
      icon: <TrendingUpIcon />,
      color: '#1b5e20',
      bgColor: '#e8f5e9',
    },
  ];

  const performanceData = {
    labels: students.slice(0, 8).map(s => `${s.firstName} ${s.lastName}`),
    datasets: [
      {
        label: 'Average Score',
        data: students.slice(0, 8).map(s => s.results?.averageScore || 0),
        backgroundColor: 'rgba(26, 35, 126, 0.8)',
        borderColor: 'rgba(26, 35, 126, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  const gradeDistribution = {
    labels: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'],
    datasets: [
      {
        label: 'Students',
        data: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'].map(grade => 
          students.filter(s => s.results?.gradePoint === grade).length
        ),
        backgroundColor: [
          '#1b5e20',
          '#2e7d32',
          '#388e3c',
          '#4caf50',
          '#ff9800',
          '#f57c00',
          '#e65100',
          '#c62828',
        ],
      },
    ],
  };

  const recentStudents = students.slice(0, 5);

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Welcome back, {school?.schoolName}!
      </Typography>

      <Grid container spacing={3}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 3,
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
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
              <Avatar
                sx={{
                  bgcolor: stat.bgColor,
                  color: stat.color,
                  width: 56,
                  height: 56,
                }}
              >
                {stat.icon}
              </Avatar>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Student Performance
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar data={performanceData} options={options} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Grade Distribution
            </Typography>
            <Box sx={{ height: 280 }}>
              <Pie data={gradeDistribution} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Paper sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Recent Students
              </Typography>
            </Box>
            <List>
              {recentStudents.map((student, index) => (
                <React.Fragment key={student._id}>
                  <ListItem
                    sx={{
                      py: 2,
                      '&:hover': { bgcolor: '#f5f5f5' },
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate('/students')}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#1a237e' }}>
                        {student.firstName[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${student.firstName} ${student.lastName}`}
                      secondary={`${student.grade} ${student.stream} • ${student.admissionNumber}`}
                    />
                    <Chip
                      label={`${student.results?.averageScore || 0}%`}
                      color={student.results?.averageScore >= 70 ? 'success' : 'warning'}
                      size="small"
                    />
                  </ListItem>
                  {index < recentStudents.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {recentStudents.length === 0 && (
                <ListItem>
                  <ListItemText primary="No students added yet" />
                </ListItem>
              )}
            </List>
            <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/students')}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                View All Students
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;