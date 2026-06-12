const Vehicle = require('../models/Vehicle');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({});
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle) res.json(vehicle);
    else res.status(404).json({ message: 'Vehicle not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVehiclesByOwner = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ ownerId: req.params.ownerId });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAvailableVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ status: 'available', approved: true });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVehiclesByLocation = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ location: { $regex: req.params.location, $options: 'i' }, status: 'available', approved: true });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addVehicle = async (req, res) => {
  try {
    const vehicle = new Vehicle({ ...req.body, ownerId: req.user._id });
    const createdVehicle = await vehicle.save();
    res.status(201).json(createdVehicle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle) {
      Object.assign(vehicle, req.body);
      const updatedVehicle = await vehicle.save();
      res.json(updatedVehicle);
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ message: error.message });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle) {
      await vehicle.deleteOne();
      res.json({ message: 'Vehicle removed' });
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle) {
      vehicle.approved = req.query.approved === 'true';
      await vehicle.save();
      res.json({ message: 'Vehicle approval updated' });
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle) {
      vehicle.status = req.query.status;
      await vehicle.save();
      res.json({ message: 'Vehicle status updated' });
    } else {
      res.status(404).json({ message: 'Vehicle not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const hasCloudinaryConfig =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      process.env.CLOUDINARY_CLOUD_NAME !== 'dxtesthosting'; // placeholder guard

    if (hasCloudinaryConfig) {
      // ── Cloudinary path ──
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'drivex_vehicles', resource_type: 'image' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        return res.send(uploadResult.secure_url);
      } catch (cloudErr) {
        console.warn('Cloudinary upload failed, falling back to local storage:', cloudErr.message);
      }
    }

    // ── Local storage fallback ──
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `vehicle-${Date.now()}${ext}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    const host = req.protocol + '://' + req.get('host');
    const imageUrl = `${host}/uploads/${filename}`;
    return res.send(imageUrl);

  } catch (error) {
    console.error('Error in uploadImage:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getVehicles, getVehicleById, getVehiclesByOwner, getAvailableVehicles, getVehiclesByLocation,
  addVehicle, updateVehicle, deleteVehicle, approveVehicle, updateStatus, uploadImage
};
