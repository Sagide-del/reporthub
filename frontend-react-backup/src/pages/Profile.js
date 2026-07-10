import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Avatar,
  Divider,
  Chip,
  IconButton,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';

const Profile = () => {
  const { school, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    schoolName: '',
    registrationNumber: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      county: '',
      postalCode: '',
    },
    logo: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/schools/profile');
      setProfile(response.data);
    } catch (error) {
      toast.error('Failed to fetch profile');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfile({
        ...profile,
        [parent]: {
          ...profile[parent],
          [child]: value,
        },
      });
    } else {
      setProfile({
        ...profile,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/schools/profile', {
        schoolName: profile.schoolName,
        phone: profile.phone,
        address: profile.address,
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await api.post('/schools/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Logo uploaded successfully!');
      setProfile({ ...profile, logo: response.data.logo });
    } catch (error) {
      toast.error('Failed to upload logo');
    }
  };

  const subscriptionStatus = school?.subscription?.status || 'pending';

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        School Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                src={profile.logo ? `http://localhost:5000/${profile.logo}` : ''}
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: 48,
                }}
              >
                {!profile.logo && profile.schoolName?.charAt(0)}
              </Avatar>
              <IconButton
                component="label"
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'white',
                  '&:hover': { bgcolor: '#f5f5f5' },
                }}
              >
                <PhotoCameraIcon />
                <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
              </IconButton>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {profile.schoolName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile.registrationNumber}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <EmailIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="body2">{profile.email}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PhoneIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="body2">{profile.phone || 'Not set'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LocationIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {profile.address?.city || 'Not set'}, {profile.address?.county || ''}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Chip
              label={`Subscription: ${subscriptionStatus}`}
              color={subscriptionStatus === 'active' ? 'success' : 'warning'}
              sx={{ width: '100%' }}
            />
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={logout}
              sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
            >
              Logout
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Edit Profile
            </Typography>
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="School Name"
                name="schoolName"
                value={profile.schoolName}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Address
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Street"
                    name="address.street"
                    value={profile.address?.street || ''}
                    onChange={handleChange}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="City"
                    name="address.city"
                    value={profile.address?.city || ''}
                    onChange={handleChange}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="County"
                    name="address.county"
                    value={profile.address?.county || ''}
                    onChange={handleChange}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Postal Code"
                    name="address.postalCode"
                    value={profile.address?.postalCode || ''}
                    onChange={handleChange}
                    size="small"
                  />
                </Grid>
              </Grid>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={loading}
                sx={{ mt: 3, borderRadius: 2, textTransform: 'none' }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;