// ✅ server/routes/task.js
import express from 'express';
import Task from '../models/Task.js';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js'; // Add this import

const router = express.Router();

// GET /api/tasks (filter based on role) 
router.get("/", authMiddleware, async (req, res) => { 
  try { 
    const user = req.user;
    let query = {}; 

    if (user.role === "Employee") {
      // See tasks assigned to them or created by them
      query = {
        $or: [
          { assignedTo: user._id },
          { createdBy: user._id }
        ]
      };
    } else if (user.role === "Manager") {
      // See tasks assigned to them by Admin + tasks they created
      query = {
        $or: [
          { createdBy: user._id },       // tasks they created for others
          { assignedTo: user._id }       // tasks assigned to them by Admin
        ]
      };
    }
    // Admin = no filter (see all)

    const tasks = await Task.find(query).populate("createdBy assignedTo", "fullName role");
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});


// POST /api/tasks (validate assignment permissions) 
router.post("/", authMiddleware, async (req, res) => { 
  const { title, description, assignedTo } = req.body; 
  const user = req.user; 

  // Validate assignment rules 
  if (assignedTo) { 
    if (user.role === "Employee") { 
      return res.status(403).json({ error: "Employees cannot assign tasks" }); 
    } 
    if (user.role === "Manager") { 
      const assignee = await User.findById(assignedTo); 
      if (assignee?.role !== "Employee") { 
        return res.status(403).json({ error: "Managers can only assign to Employees" }); 
      } 
    } 
  } 

  // Create the task 
  const task = new Task({ ...req.body, createdBy: user._id }); 
  await task.save(); 
  req.io.emit("taskCreated"); 
  res.status(201).json(task); 
}); 

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Allow updates if: creator, assigned user, or admin
    const isAllowed = (
      task.createdBy.equals(req.user._id) ||
      task.assignedTo?.equals(req.user._id) ||
      req.user.role === 'Admin'
    );

    if (!isAllowed) return res.status(403).json({ error: 'Not authorized' });

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.io.emit('taskUpdated');
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Only creator or admin can delete
    if (!task.createdBy.equals(req.user._id) && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Task.findByIdAndDelete(req.params.id);
    req.io.emit('taskDeleted');
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;

