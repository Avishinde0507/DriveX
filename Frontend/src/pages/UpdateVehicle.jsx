import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { vehicleAPI } from '../services/api';
import { getVehicleImageUrl } from '../utils/helpers';
import Sidebar from '../components/Sidebar';

const NAV_ITEMS = [
  { key: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
  { key: 'fleet', icon: 'fa-car', label: 'My Vehicles' },
  { key: 'bookings', icon: 'fa-clipboard-list', label: 'Booking Requests' },
  { key: 'active', icon: 'fa-road', label: 'Active Rentals' },
];

export default function UpdateVehicle() {
  const { id } = useParams();
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const [vehicleForm, setVehicleForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const addFilesInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image size should be less than 5MB', 'error');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (e) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    setVehicleForm({ ...vehicleForm, image: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Image "${file.name}" is larger than 5MB`, 'error');
        return;
      }
      validFiles.push(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });

    setNewFiles(prev => [...prev, ...validFiles]);
  };

  const removeExistingImage = (idx) => {
    setExistingImages(prev => prev.filter((_, i) => i !== idx));
  };

  const removeNewImage = (idx) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
    setNewPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'owner') { navigate('/login'); return; }

    async function load() {
      try {
        const v = await vehicleAPI.getById(id);
        if (v.ownerId !== currentUser.id) {
          showToast('Unauthorized access.', 'error');
          navigate('/owner');
          return;
        }
        setVehicleForm(v);
        if (v.image) setImagePreview(v.image);
        if (v.images) setExistingImages(v.images);
      } catch {
        showToast('Vehicle not found.', 'error');
        navigate('/owner');
      }
    }
    load();
  }, [currentUser, navigate, id, showToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = vehicleForm.image;

      if (imageFile) {
        const uploadRes = await vehicleAPI.uploadImage(imageFile);
        imageUrl = uploadRes.url || uploadRes;
      }

      // Upload new additional images in parallel
      let newUrls = [];
      if (newFiles.length > 0) {
        const uploadPromises = newFiles.map(file => vehicleAPI.uploadImage(file));
        const uploadResults = await Promise.all(uploadPromises);
        newUrls = uploadResults.map(res => res.url || res);
      }

      const finalImages = [...existingImages, ...newUrls];

      await vehicleAPI.update(id, {
        ...vehicleForm,
        image: imageUrl,
        images: finalImages,
        priceDaily: Number(vehicleForm.priceDaily),
        priceWeekly: Number(vehicleForm.priceWeekly),
        priceMonthly: Number(vehicleForm.priceMonthly),
        seats: Number(vehicleForm.seats),
      });
      showToast('Vehicle updated successfully!');
      navigate('/owner');
    } catch (err) {
      showToast(err.message || 'Failed to update vehicle.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || !vehicleForm) return null;

  return (
    <div className="dashboard-layout">
      <Sidebar navItems={NAV_ITEMS} activeSection="fleet" onSectionChange={() => navigate('/owner')} />
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/owner')} style={{ padding: '8px' }}>
              <i className="fas fa-arrow-left" style={{ fontSize: '1.2rem' }}></i>
            </button>
            <div>
              <h1>Update Vehicle</h1>
              <p>Edit details for {vehicleForm.name} ({vehicleForm.regNumber})</p>
            </div>
          </div>
        </div>

        <div className="panel animate-visible">
          <div className="panel-header"><h2>Vehicle Information</h2></div>
          <div className="panel-body">
            <form onSubmit={handleSubmit}>
              <div className="image-upload-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ flex: '1' }}>
                  <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-primary)' }}>
                    <i className="fas fa-camera" style={{ color: 'var(--accent)', marginRight: '6px' }}></i>
                    Main Cover Photo
                  </label>
                  <div className="image-upload-area" onClick={() => fileInputRef.current.click()} style={{ height: '200px' }}>
                    <input
                      type="file"
                      hidden
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageChange}
                    />

                    {imagePreview ? (
                      <>
                        <div className="image-preview-container">
                          <img
                            src={getVehicleImageUrl(imagePreview)}
                            alt="Vehicle Preview"
                          />
                        </div>
                        <button type="button" className="remove-image-btn" onClick={removeImage}>
                          <i className="fas fa-times"></i>
                        </button>
                        <p style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>Click to change cover image</p>
                      </>
                    ) : (
                      <div className="upload-placeholder">
                        <i className="fas fa-cloud-upload-alt"></i>
                        <p>Upload Main Vehicle Photo</p>
                        <span>Supports: JPG, PNG, WEBP (Max 5MB)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Photos (Angles, Interior & Exterior) */}
                <div style={{ flex: '1', marginTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-primary)' }}>
                    <i className="fas fa-images" style={{ color: 'var(--accent)', marginRight: '6px' }}></i>
                    Additional Photos (Angles, Interior & Exterior)
                  </label>
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Render surviving existing images from DB */}
                    {existingImages.map((url, idx) => (
                      <div key={`existing-${idx}`} style={{ position: 'relative', width: '120px', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                        <img src={getVehicleImageUrl(url)} alt={`Existing Angle ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeExistingImage(idx); }}
                          style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255, 75, 75, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', transition: 'var(--transition)', zIndex: 5 }}
                          title="Remove photo"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    ))}

                    {/* Render newly added local images */}
                    {newPreviews.map((preview, idx) => (
                      <div key={`new-${idx}`} style={{ position: 'relative', width: '120px', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                        <img src={preview} alt={`New Angle ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeNewImage(idx); }}
                          style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255, 75, 75, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', transition: 'var(--transition)', zIndex: 5 }}
                          title="Remove photo"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    ))}

                    {/* Add Angle Button */}
                    <div
                      onClick={() => addFilesInputRef.current.click()}
                      style={{ width: '120px', height: '90px', borderRadius: '8px', border: '2px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', transition: 'all 0.2s ease' }}
                      className="add-angle-photo-btn"
                    >
                      <i className="fas fa-plus" style={{ fontSize: '1.2rem', color: 'var(--accent)', marginBottom: '5px' }}></i>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Add Angle</span>
                      <input
                        type="file"
                        multiple
                        hidden
                        ref={addFilesInputRef}
                        accept="image/*"
                        onChange={handleNewAdditionalImagesChange}
                      />
                    </div>
                  </div>
                  <small className="text-muted" style={{ display: 'block', marginTop: '8px' }}>
                    Upload snapshots of interior dashboard, seats, front, side, and rear angles.
                  </small>
                </div>
              </div>

              <div className="form-divider" style={{ margin: '20px 0', height: '1px', background: 'var(--glass-border)' }}></div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vehicle Name</label>
                  <input type="text" required value={vehicleForm.name}
                    onChange={e => setVehicleForm({ ...vehicleForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Brand</label>
                  <input type="text" required value={vehicleForm.brand}
                    onChange={e => setVehicleForm({ ...vehicleForm, brand: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Model Year</label>
                  <input type="text" required value={vehicleForm.model}
                    onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <select required value={vehicleForm.type}
                    onChange={e => setVehicleForm({ ...vehicleForm, type: e.target.value })}>
                    <option value="2W">2-Wheeler</option>
                    <option value="4W">4-Wheeler</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Seats</label>
                  <input type="number" required value={vehicleForm.seats}
                    onChange={e => setVehicleForm({ ...vehicleForm, seats: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fuel Type</label>
                  <select value={vehicleForm.fuel}
                    onChange={e => setVehicleForm({ ...vehicleForm, fuel: e.target.value })}>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Electric">Electric</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Transmission</label>
                  <select value={vehicleForm.transmission}
                    onChange={e => setVehicleForm({ ...vehicleForm, transmission: e.target.value })}>
                    <option value="Manual">Manual</option>
                    <option value="Automatic">Automatic</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Registration Number</label>
                  <input type="text" readOnly disabled
                    style={{ background: 'var(--bg-card)', cursor: 'not-allowed' }}
                    value={vehicleForm.regNumber} />
                  <small className="text-muted">Registration number cannot be changed.</small>
                </div>
              </div>

              <div className="form-divider" style={{ margin: '20px 0', height: '1px', background: 'var(--glass-border)' }}></div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontFamily: 'var(--font-heading)' }}>Pricing Details</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Daily Price (₹)</label>
                  <input type="number" required value={vehicleForm.priceDaily}
                    onChange={e => setVehicleForm({ ...vehicleForm, priceDaily: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Weekly Price (₹)</label>
                  <input type="number" required value={vehicleForm.priceWeekly}
                    onChange={e => setVehicleForm({ ...vehicleForm, priceWeekly: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Monthly Price (₹)</label>
                  <input type="number" required value={vehicleForm.priceMonthly}
                    onChange={e => setVehicleForm({ ...vehicleForm, priceMonthly: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Pickup Location</label>
                  <input type="text" required value={vehicleForm.location}
                    onChange={e => setVehicleForm({ ...vehicleForm, location: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={vehicleForm.status}
                    onChange={e => setVehicleForm({ ...vehicleForm, status: e.target.value })}>
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="rented">Rented (Automatic)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea value={vehicleForm.description}
                  onChange={e => setVehicleForm({ ...vehicleForm, description: e.target.value })}></textarea>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 2 }} disabled={loading}>
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} Update Vehicle
                </button>
                <button type="button" className="btn btn-outline btn-lg" style={{ flex: 1 }} onClick={() => navigate('/owner')}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
