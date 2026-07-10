import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Person as PersonIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';

const Recommendations = () => {
  const { school } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    teacherName: '',
    position: '',
    yearsOfService: '',
    achievements: '',
    reason: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/recommendations/generate', formData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `recommendation-${formData.teacherName.replace(/\s/g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Recommendation letter generated successfully!');
    } catch (error) {
      toast.error('Failed to generate recommendation letter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Teacher Recommendation Letters
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Generate Recommendation Letter
            </Typography>
            <form onSubmit={handleGenerate}>
              <TextField
                fullWidth
                label="Teacher Name"
                name="teacherName"
                value={formData.teacherName}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <TextField
                fullWidth
                label="Position/Title"
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: <WorkIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
              <TextField
                fullWidth
                label="Years of Service"
                name="yearsOfService"
                type="number"
                value={formData.yearsOfService}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Achievements"
                name="achievements"
                multiline
                rows={3}
                value={formData.achievements}
                onChange={handleChange}
                placeholder="List the teacher's key achievements..."
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Reason for Recommendation"
                name="reason"
                multiline
                rows={3}
                value={formData.reason}
                onChange={handleChange}
                placeholder="Why are you recommending this teacher?"
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                startIcon={<DownloadIcon />}
                disabled={loading}
                sx={{ borderRadius: 2, textTransform: 'none', py: 1.5 }}
              >
                {loading ? 'Generating...' : 'Generate Recommendation Letter'}
              </Button>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Letter Preview
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, minHeight: 300 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {school?.schoolName || 'Your School'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {school?.address?.city || 'City'}, {school?.address?.county || 'County'}
                </Typography>
                <Divider />
                <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
                  To Whom It May Concern,
                </Typography>
                <Typography variant="body2" sx={{ mt: 2 }}>
                  I am pleased to recommend <strong>{formData.teacherName || '[Teacher Name]'}</strong> who has served at our school as a{' '}
                  <strong>{formData.position || '[Position]'}</strong> for the past{' '}
                  <strong>{formData.yearsOfService || '[Years]'}</strong> years.
                </Typography>
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  {formData.reason || '[Recommendation reason will appear here]'}
                </Typography>
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2">Yours sincerely,</Typography>
                  <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                    Principal
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Recommendations;