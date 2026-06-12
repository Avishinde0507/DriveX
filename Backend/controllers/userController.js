const User = require('../models/User');

const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUsersByRole = async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.active = !user.active;
      const updatedUser = await user.save();
      res.json({ success: true, active: updatedUser.active });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.city = req.body.city || user.city;
      user.company = req.body.company || user.company;
      if (req.body.password) {
        user.password = req.body.password;
      }
      const updatedUser = await user.save();
      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        city: updatedUser.city,
        company: updatedUser.company,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      await user.deleteOne();
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUsers, getUserById, getUsersByRole, toggleActive, updateUser, deleteUser };
