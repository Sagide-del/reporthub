import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  LinearProgress,
  Alert,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';

const Reports = () => {
  const { school } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState({
    grade: '',
    stream: '',
    term: 'Term 1',
  });

  useEffect(() => {
    fetchStudents();
  }, [filters]);

  const fetchStudents = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.grade) params.append('grade', filters.grade);
      if (filters.stream) params.append('stream', filters.stream);
      if (filters.term) params.append('term', filters.term);
      
      const response = await api.get(`/students?${params.toString()}`);
      setStudents(response.data);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (studentId, name) => {
    setGenerating(true);
    try {
      const response = await api.post(`/reports/generate/${studentId}`, {}, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report downloaded successfully!');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const generateAllReports = async () => {
    if (students.length === 0) {
      toast.warning('No students available');
      return;
    }

    setGenerating(true);
    let success = 0;
    let failed = 0;

    for (const student of students) {
      try {
        const response = await api.post(`/reports/generate/${student._id}`, {}, {
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report-${student.admissionNumber}-${student.firstName}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        success++;
      } catch (error) {
        failed++;
      }
    }

    setGenerating(false);
    toast.success(`Generated ${success} reports, ${failed} failed`);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('term', filters.term);
    formData.append('academicYear', new Date().getFullYear().toString());
    formData.append('grade', filters.grade || 'Form 1');
    formData.append('stream', filters.stream || 'A');

    try {
      const response = await api.post('/reports/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${response.data.totalStudents} students imported successfully!`);
      fetchStudents();
    } catch (error) {
      toast.error('Failed to import results');
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Reports
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={generateAllReports}
            disabled={generating || students.length === 0}
            sx={{ mr: 1, borderRadius: 2, textTransform: 'none' }}
          >
            {generating ? 'Generating...' : 'Generate All'}
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Import Results
            <input type="file" accept=".csv" hidden onChange={handleFileUpload} />
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Import Instructions
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>CSV Format:</strong> AdmissionNumber, FirstName, LastName, 
            Mathematics_CAT1, Mathematics_CAT2, Mathematics_END, 
            Biology_CAT1, Biology_CAT2, Biology_END, ...
          </Typography>
        </Alert>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Grade"
              size="small"
              value={filters.grade}
              onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Form 1">Form 1</MenuItem>
              <MenuItem value="Form 2">Form 2</MenuItem>
              <MenuItem value="Form 3">Form 3</MenuItem>
              <MenuItem value="Form 4">Form 4</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Stream"
              size="small"
              value={filters.stream}
              onChange={(e) => setFilters({ ...filters, stream: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="A">A</MenuItem>
              <MenuItem value="B">B</MenuItem>
              <MenuItem value="C">C</MenuItem>
              <MenuItem value="D">D</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Term"
              size="small"
              value={filters.term}
              onChange={(e) => setFilters({ ...filters, term: e.target.value })}
            >
              <MenuItem value="Term 1">Term 1</MenuItem>
              <MenuItem value="Term 2">Term 2</MenuItem>
              <MenuItem value="Term 3">Term 3</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchStudents}
              sx={{ height: '100%' }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell>Admission No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Stream</TableCell>
                <TableCell>Avg Score</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student._id} hover>
                  <TableCell>{student.admissionNumber}</TableCell>
                  <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                  <TableCell>{student.grade}</TableCell>
                  <TableCell>{student.stream}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${student.results?.averageScore || 0}%`}
                      color={student.results?.averageScore >= 70 ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={student.results?.gradePoint || '-'}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      startIcon={<PdfIcon />}
                      onClick={() => generateReport(student._id, `${student.firstName}-${student.lastName}`)}
                      disabled={generating}
                    >
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      No students found. Import results from CSV or add students first.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Reports;