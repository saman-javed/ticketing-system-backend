// ✅ server/models/User.js
import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  phone: String,
  password: String,
  role: { 
  type: String, 
  enum: ["Employee", "Manager", "Admin"], 
  default: "Employee" 
}
});
export default mongoose.model('User', userSchema);