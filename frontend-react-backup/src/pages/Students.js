import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  MenuItem,
  Grid,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';

const Students = () => {
  const { school } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    admissionNumber: '',
    firstName: '',
    lastName: '',
    grade: 'Form 1',
    stream: 'A',
    term: 'Term 1',
    academicYear: new Date().getFullYear().toString(),
  });
  const [filters, setFilters] = useState({
    grade: '',
    stream: '',
    term: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleOpenDialog = (student = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        grade: student.grade,
        stream: student.stream,
        term: student.term,
        academicYear: student.academicYear,
      });
    } else {
      setEditingStudent(null);
      setFormData({
        admissionNumber: '',
        firstName: '',
        lastName: '',
        grade: 'Form 1',
        stream: 'A',
        term: 'Term 1',
        academicYear: new Date().getFullYear().toString(),
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingStudent(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent._id}`, formData);
        toast.success('Student updated successfully!');
      } else {
        await api.post('/students', formData);
        toast.success('Student added successfully!');
      }
      handleCloseDialog();
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await api.delete(`/students/${id}`);
        toast.success('Student deleted successfully!');
        fetchStudents();
      } catch (error) {
        toast.error('Failed to delete student');
      }
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('term', 'Term 1');
    formData.append('academicYear', new Date().getFullYear().toString());
    formData.append('grade', 'Form 1');
    formData.append('stream', 'A');

    try {
      await api.post('/reports/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Students imported successfully!');
      fetchStudents();
    } catch (error) {
      toast.error('Failed to import students');
    }
  };

  const filteredStudents = students.filter((student) => {
    const search = searchTerm.toLowerCase();
    return (
      student.admissionNumber.toLowerCase().includes(search) ||
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(search)
    );
  });

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Students
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ mr: 1, borderRadius: 2, textTransform: 'none' }}
          >
            Add Student
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Import CSV
            <input type="file" accept=".csv" hidden onChange={handleFileUpload} />
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Grade"
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
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Stream"
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
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Term"
              value={filters.term}
              onChange={(e) => setFilters({ ...filters, term: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Term 1">Term 1</MenuItem>
              <MenuItem value="Term 2">Term 2</MenuItem>
              <MenuItem value="Term 3">Term 3</MenuItem>
            </TextField>
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
                <TableCell>Term</TableCell>
                <TableCell>Avg Score</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student._id} hover>
                  <TableCell>{student.admissionNumber}</TableCell>
                  <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                  <TableCell>{student.grade}</TableCell>
                  <TableCell>{student.stream}</TableCell>
                  <TableCell>{student.term}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${student.results?.averageScore || 0}%`}
                      color={student.results?.averageScore >= 70 ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {student.results?.position ? `${student.results.position}/${student.results.totalStudents}` : '-'}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenDialog(student)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(student._id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      No students found. Add your first student or import from CSV.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingStudent ? 'Edit Student' : 'Add New Student'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Admission Number"
              name="admissionNumber"
              value={formData.admissionNumber}
              onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  label="Grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                >
                  <MenuItem value="Form 1">Form 1</MenuItem>
                  <MenuItem value="Form 2">Form 2</MenuItem>
                  <MenuItem value="Form 3">Form 3</MenuItem>
                  <MenuItem value="Form 4">Form 4</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  label="Stream"
                  value={formData.stream}
                  onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                >
                  <MenuItem value="A">A</MenuItem>
                  <MenuItem value="B">B</MenuItem>
                  <MenuItem value="C">C</MenuItem>
                  <MenuItem value="D">D</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField
              fullWidth
              select
              label="Term"
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              sx={{ mt: 2 }}
            >
              <MenuItem value="Term 1">Term 1</MenuItem>
              <MenuItem value="Term 2">Term 2</MenuItem>
              <MenuItem value="Term 3">Term 3</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Academic Year"
              value={formData.academicYear}
              onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingStudent ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Students;