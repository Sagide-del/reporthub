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
  Article as ArticleIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';

const Newsletters = () => {
  const { school } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    term: 'Term 1',
    academicYear: new Date().getFullYear().toString(),
    content: {
      principalMessage: '',
      academicHighlights: '',
      sportsAndActivities: '',
      upcomingEvents: '',
      achievements: '',
      announcements: '',
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        content: {
          ...formData.content,
          [child]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/newsletters/generate', formData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `newsletter-${formData.term}-${formData.academicYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Newsletter generated successfully!');
    } catch (error) {
      toast.error('Failed to generate newsletter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        School Newsletters
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Generate Newsletter
            </Typography>
            <form onSubmit={handleGenerate}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    select
                    label="Term"
                    name="term"
                    value={formData.term}
                    onChange={handleChange}
                    required
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Academic Year"
                    name="academicYear"
                    value={formData.academicYear}
                    onChange={handleChange}
                    required
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
                Newsletter Content
              </Typography>

              <TextField
                fullWidth
                label="Principal's Message"
                name="content.principalMessage"
                multiline
                rows={2}
                value={formData.content.principalMessage}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Academic Highlights"
                name="content.academicHighlights"
                multiline
                rows={2}
                value={formData.content.academicHighlights}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Sports and Activities"
                name="content.sportsAndActivities"
                multiline
                rows={2}
                value={formData.content.sportsAndActivities}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Upcoming Events"
                name="content.upcomingEvents"
                multiline
                rows={2}
                value={formData.content.upcomingEvents}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Achievements"
                name="content.achievements"
                multiline
                rows={2}
                value={formData.content.achievements}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Announcements"
                name="content.announcements"
                multiline
                rows={2}
                value={formData.content.announcements}
                onChange={handleChange}
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
                {loading ? 'Generating...' : 'Generate Newsletter'}
              </Button>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Newsletter Preview
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 2, maxHeight: 500, overflow: 'auto' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', textAlign: 'center' }}>
                  {school?.schoolName || 'Your School'}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                  {formData.term} Newsletter - {formData.academicYear}
                </Typography>
                <Divider sx={{ my: 2 }} />

                {formData.content.principalMessage && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Principal's Message</Typography>
                    <Typography variant="body2">{formData.content.principalMessage}</Typography>
                    <Divider sx={{ my: 1 }} />
                  </>
                )}

                {formData.content.academicHighlights && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Academic Highlights</Typography>
                    <Typography variant="body2">{formData.content.academicHighlights}</Typography>
                    <Divider sx={{ my: 1 }} />
                  </>
                )}

                {formData.content.sportsAndActivities && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Sports and Activities</Typography>
                    <Typography variant="body2">{formData.content.sportsAndActivities}</Typography>
                    <Divider sx={{ my: 1 }} />
                  </>
                )}

                {formData.content.upcomingEvents && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Upcoming Events</Typography>
                    <Typography variant="body2">{formData.content.upcomingEvents}</Typography>
                    <Divider sx={{ my: 1 }} />
                  </>
                )}

                {formData.content.achievements && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Achievements</Typography>
                    <Typography variant="body2">{formData.content.achievements}</Typography>
                    <Divider sx={{ my: 1 }} />
                  </>
                )}

                {formData.content.announcements && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Announcements</Typography>
                    <Typography variant="body2">{formData.content.announcements}</Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Newsletters;