import express from 'express';
import cors from 'cors';
import supabase from './index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

// Revert to fallback for JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Register endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    // Check if user exists
    const { data: existing, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    // Hash password
    const hash = await bcrypt.hash(password, 10);
    // Insert user
    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: hash }])
      .select('id, username')
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id, username: data.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password')
      .eq('username', username)
      .single();
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    // Create JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, sub: user.username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Get current user
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const { id } = req.user;
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, highscore')
      .eq('id', id)
      .single();
    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/random-destination', async (req, res) => {
  try {
    // Step 1: Get all IDs
    const { data: ids, error: idError } = await supabase
      .from('destinations')
      .select('id');
    if (idError) throw idError;
    if (!ids || ids.length === 0) {
      return res.status(404).json({ error: 'No destinations found' });
    }
    // Step 2: Pick a random ID
    const randomIndex = Math.floor(Math.random() * ids.length);
    const randomId = ids[randomIndex].id;
    // Step 3: Fetch the row by ID
    const { data, error } = await supabase
      .from('destinations')
      .select('*')
      .eq('id', randomId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New endpoint: Get 3 random cities from 'cities' table, excluding a given city
app.get('/random-cities', async (req, res) => {
  try {
    const excludeCity = req.query.exclude;
    // Step 1: Get all city names except the excluded one
    let query = supabase
      .from('cities')
      .select('city');
    if (excludeCity) {
      query = query.neq('city', excludeCity);
    }
    const { data: cities, error } = await query;
    if (error) throw error;
    if (!cities || cities.length < 3) {
      return res.status(404).json({ error: 'Not enough cities found' });
    }
    // Step 2: Pick 3 random cities
    const shuffled = cities.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3).map(c => c.city);
    res.json(selected);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update highscore endpoint
app.post('/update-highscore', authMiddleware, async (req, res) => {
  let { highscore } = req.body;
  const username = req.user.username;
  highscore = Number(highscore);
  if (!Number.isInteger(highscore)) {
    return res.status(400).json({ error: 'Highscore must be an integer' });
  }
  try {
    // Get current highscore using username
    const { data: user, error: getError } = await supabase
      .from('users')
      .select('highscore')
      .eq('username', username)
      .single();
    if (getError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.highscore !== null && user.highscore !== undefined && highscore <= user.highscore) {
      return res.json({ highscore: user.highscore }); // No update needed
    }
    // Update highscore using username
    const { error: updateError, data: updateData } = await supabase
      .from('users')
      .update({ highscore })
      .eq('username', username)
      .select('highscore');
    if (updateError) throw updateError;
    res.json({ highscore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a challenge
app.post('/create-challenge', authMiddleware, async (req, res) => {
  const challenger_username = req.user.username;
  const num_questions = req.body.num_questions || 5;
  try {
    // Get all destination IDs
    const { data: ids, error: idError } = await supabase
      .from('destinations')
      .select('id');
    if (idError) throw idError;
    if (!ids || ids.length < num_questions) {
      return res.status(400).json({ error: 'Not enough destinations for challenge' });
    }
    // Pick random unique IDs
    const shuffled = ids.sort(() => 0.5 - Math.random());
    const selectedIds = shuffled.slice(0, num_questions).map(row => row.id);
    // Insert challenge with only question_ids
    const { data: challenge, error: insertError } = await supabase
      .from('challenges')
      .insert([{ challenger_username, question_ids: selectedIds }])
      .select('*')
      .single();
    if (insertError) throw insertError;
    res.status(201).json({
      challenge,
      link: `/challenge/${challenge.id}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get challenge by challenge ID
app.get('/challenge/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('id, challenger_username, friend_username, challenger_score, friend_score, question_ids, created_at, started')
      .eq('id', id)
      .single();
    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit score for a challenge by challenge ID
app.post('/challenge/:id/submit', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { score } = req.body;
  const submitter = req.user.username;
  try {
    // Fetch challenge
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    let update = {};
    if (submitter === challenge.challenger_username) {
      update.challenger_score = score;
    } else {
      update.friend_username = submitter;
      update.friend_score = score;
    }
    const { data: updated, error: updateError } = await supabase
      .from('challenges')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Challenge mode: get a specific question by question_id (reuse single player logic)
app.get('/challenge/:id/question/:qnum', async (req, res) => {
  const { id, qnum } = req.params;
  try {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('question_ids')
      .eq('id', id)
      .single();
    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    const idx = parseInt(qnum, 10);
    if (!challenge.question_ids || !Array.isArray(challenge.question_ids) || idx < 0 || idx >= challenge.question_ids.length) {
      return res.status(400).json({ error: 'Invalid question number' });
    }
    const questionId = challenge.question_ids[idx];
    // Fetch the question data as in single player
    const { data: dest, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('id', questionId)
      .single();
    if (destError || !dest) {
      return res.status(404).json({ error: 'Question not found' });
    }
    // Get 3 random wrong cities
    let { data: wrongCities, error: cityError } = await supabase
      .from('cities')
      .select('city');
    if (cityError) throw cityError;
    wrongCities = wrongCities.filter(c => c.city !== dest.city);
    const shuffledCities = wrongCities.sort(() => 0.5 - Math.random());
    const options = [dest.city, ...shuffledCities.slice(0, 3).map(c => c.city)].sort(() => 0.5 - Math.random());
    res.json({ id: dest.id, clues: dest.clues, options, fun_fact: dest.fun_fact, trivia: dest.trivia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Challenge mode: check answer for a specific question by question_id
app.post('/challenge/:id/answer/:qnum', async (req, res) => {
  const { id, qnum } = req.params;
  const { guess } = req.body;
  try {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('question_ids')
      .eq('id', id)
      .single();
    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    const idx = parseInt(qnum, 10);
    if (!challenge.question_ids || !Array.isArray(challenge.question_ids) || idx < 0 || idx >= challenge.question_ids.length) {
      return res.status(400).json({ error: 'Invalid question number' });
    }
    const questionId = challenge.question_ids[idx];
    // Fetch the question data as in single player
    const { data: dest, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('id', questionId)
      .single();
    if (destError || !dest) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const correct = guess === dest.city;
    if (correct) {
      res.json({
        correct,
        fun_fact: dest.fun_fact,
        trivia: dest.trivia
      });
    } else {
      res.json({ correct });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join challenge by challenge ID (update friend_username)
app.post('/challenge/:id/join', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const friend_username = req.user.username;
  try {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    // Always set friend_username if not the challenger
    let updated = challenge;
    if (friend_username !== challenge.challenger_username) {
      const updateRes = await supabase
        .from('challenges')
        .update({ friend_username })
        .eq('id', id)
        .select('*')
        .single();
      if (updateRes.error) {
        throw updateRes.error;
      }
      updated = updateRes.data;
    }
    res.json({
      id: updated.id,
      challenger_username: updated.challenger_username,
      friend_username: updated.friend_username,
      challenger_score: updated.challenger_score,
      friend_score: updated.friend_score,
      question_ids: updated.question_ids,
      created_at: updated.created_at,
      started: updated.started
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH endpoint to allow updating friend_username if needed
// This can be used for admin or recovery purposes if the friend_username needs to be changed after initial join.
app.patch('/challenge/:id/friend', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { friend_username } = req.body;
  try {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    if (friend_username && friend_username !== challenge.challenger_username) {
      const { data: updated, error: updateError } = await supabase
        .from('challenges')
        .update({ friend_username })
        .eq('id', id)
        .select('*')
        .single();
      if (updateError) throw updateError;
      return res.json(updated);
    }
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app; 