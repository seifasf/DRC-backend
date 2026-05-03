const Appointment = require('../models/Appointment.model');

exports.listAppointments = async (req, res) => {
  try {
    const list = await Appointment.find()
      .populate('clientId', 'name email phone')
      .populate('handledBy', 'name email')
      .sort({ requestedDate: 1 });
    return res.json({ success: true, data: { appointments: list } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.myAppointments = async (req, res) => {
  try {
    const list = await Appointment.find({ clientId: req.user._id })
      .populate('handledBy', 'name email')
      .sort({ requestedDate: -1 });
    return res.json({ success: true, data: { appointments: list } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const { requestedDate, purpose, notes } = req.body;
    const appt = await Appointment.create({
      clientId: req.user._id,
      requestedDate,
      purpose,
      notes,
      status: 'pending',
    });

    const populated = await Appointment.findById(appt._id).populate('clientId', 'name email');
    return res.status(201).json({ success: true, data: { appointment: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.confirmAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    appt.status = 'confirmed';
    appt.confirmedDate = req.body.confirmedDate ? new Date(req.body.confirmedDate) : appt.requestedDate;
    appt.handledBy = req.user._id;
    if (req.body.notes) appt.notes = req.body.notes;
    await appt.save();

    const populated = await Appointment.findById(appt._id)
      .populate('clientId', 'name email')
      .populate('handledBy', 'name email');

    return res.json({ success: true, data: { appointment: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (req.user.role === 'client' && String(appt.clientId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    appt.status = 'cancelled';
    await appt.save();

    const populated = await Appointment.findById(appt._id)
      .populate('clientId', 'name email')
      .populate('handledBy', 'name email');

    return res.json({ success: true, data: { appointment: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.completeAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    appt.status = 'completed';
    appt.handledBy = req.user._id;
    await appt.save();

    const populated = await Appointment.findById(appt._id)
      .populate('clientId', 'name email')
      .populate('handledBy', 'name email');

    return res.json({ success: true, data: { appointment: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
