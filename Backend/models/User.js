const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'owner', 'admin'], default: 'customer' },
  phone: { type: String, default: '' },
  city: { type: String, default: '' },
  company: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  active: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
  // Email change OTP fields
  emailOtp: { type: String, default: null },
  emailOtpExpiry: { type: Date, default: null },
  pendingEmail: { type: String, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Password hash middleware
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
