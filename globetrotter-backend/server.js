import http from 'http';
import { Server } from 'socket.io';
import app from './api.js';
import supabase from './index.js';
import express from 'express';
import cors from 'cors';

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] } // Adjust for your frontend
});

// Expose io on the app for access in API routes
app.set('io', io);

// In-memory challenge state for demo (not for production)
const challengeState = {};
// Make challengeRoomUsers global for API access
if (!global.challengeRoomUsers) global.challengeRoomUsers = {};
const challengeRoomUsers = global.challengeRoomUsers;

// Helper to emit latest challenge object to the room
async function emitChallengeUpdate(io, challengeId) {
  const { data: challenge, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single();
  if (!error && challenge) {
    io.to(`challenge:${challengeId}`).emit('challenge_update', challenge);
    console.log(`[Socket] challenge_update emitted for challenge ${challengeId}`);
  } else {
    console.log(`[Socket] Failed to fetch challenge for emit: ${error && error.message}`);
  }
}

io.on('connection', (socket) => {
  console.log('[Socket] New client connected');
  socket.on('join_challenge', async ({ challengeId, username }) => {
    console.log(`[Socket] join_challenge: ${username} for challenge ${challengeId}`);
    socket.join(`challenge:${challengeId}`);
    console.log(`[Socket] ${username} joined challenge:${challengeId}`);
    // Track users in the room
    if (!challengeRoomUsers[challengeId]) challengeRoomUsers[challengeId] = new Set();
    challengeRoomUsers[challengeId].add(username);
    // Ensure challengeState is initialized
    if (!challengeState[challengeId]) {
      challengeState[challengeId] = {
        currentIndex: 0,
        answers: {},
        finished: false
      };
      console.log(`[Socket] Initialized challengeState for ${challengeId}`);
    }
    // Check if both challenger and friend are present
    try {
      const { data: challenge, error } = await supabase
        .from('challenges')
        .select('challenger_username, friend_username, started')
        .eq('id', challengeId)
        .single();
      if (!error && challenge && challenge.challenger_username && challenge.friend_username) {
        // Both usernames must be present in the room
        if (
          challengeRoomUsers[challengeId].has(challenge.challenger_username) &&
          challengeRoomUsers[challengeId].has(challenge.friend_username) &&
          !challenge.started
        ) {
          // Set started=true in DB
          await supabase
            .from('challenges')
            .update({ started: true })
            .eq('id', challengeId);
          io.to(`challenge:${challengeId}`).emit('start_challenge', { challengeId });
        }
      }
    } catch (err) {
      console.error('Error checking both players in room:', err.message);
    }
    // No both_ready emission here; handled in /challenge/:id/join
    socket.to(`challenge:${challengeId}`).emit('user_joined', { username });
    // Emit latest challenge object to the room
    emitChallengeUpdate(io, challengeId);
  });

  // Start the challenge: challenger triggers this
  socket.on('start_challenge', async ({ challengeId }) => {
    console.log(`[Socket] start_challenge for challenge ${challengeId}`);
    if (!challengeState[challengeId]) {
      challengeState[challengeId] = {
        currentIndex: 0,
        answers: {}, // { [questionIndex]: { [username]: answer } }
        finished: false
      };
    }
    // Set started=true in the DB
    try {
      await supabase
        .from('challenges')
        .update({ started: true })
        .eq('id', challengeId);
    } catch (err) {
      console.error('Failed to set started=true in DB:', err.message);
    }
    io.to(`challenge:${challengeId}`).emit('next_question', { questionIndex: 0 });
    // Emit latest challenge object to the room
    emitChallengeUpdate(io, challengeId);
  });

  // When a player answers a question
  socket.on('answer', async ({ challengeId, questionIndex, username, answer }) => {
    console.log(`[Socket] answer from ${username} for challenge ${challengeId}, question ${questionIndex}`);
    if (!challengeState[challengeId]) {
      console.log(`[Socket] challengeState missing for ${challengeId}, initializing.`);
      challengeState[challengeId] = { currentIndex: 0, answers: {}, finished: false };
    }
    if (!challengeState[challengeId].answers[questionIndex]) {
      challengeState[challengeId].answers[questionIndex] = {};
    }
    challengeState[challengeId].answers[questionIndex][username] = answer;
    console.log(`[Socket] Current answers for challenge ${challengeId}:`, JSON.stringify(challengeState[challengeId].answers));
    // Always update score in DB for this user
    try {
      const { data: challenge, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();
      if (!error && challenge) {
        // Count correct answers for this user
        let userScore = 0;
        for (const qIdx in challengeState[challengeId].answers) {
          const ans = challengeState[challengeId].answers[qIdx][username];
          // Fetch the correct answer for this question
          const qNum = parseInt(qIdx, 10);
          const questionId = challenge.question_ids[qNum];
          const { data: dest, error: destError } = await supabase
            .from('destinations')
            .select('city')
            .eq('id', questionId)
            .single();
          if (!destError && dest && ans === dest.city) {
            userScore++;
          }
        }
        console.log(`[Socket] Calculated userScore for ${username}: ${userScore}`);
        let update = {};
        if (username === challenge.challenger_username) {
          update.challenger_score = userScore;
        } else if (username === challenge.friend_username) {
          update.friend_score = userScore;
        }
        if (Object.keys(update).length > 0) {
          const { error: updateError } = await supabase
            .from('challenges')
            .update(update)
            .eq('id', challengeId);
          if (updateError) {
            console.log(`[Socket] Error updating score in DB: ${updateError.message}`);
          } else {
            console.log(`[Socket] Updated score in DB for ${username}: ${userScore}`);
            // Fetch and log updated challenge row
            const { data: updatedChallenge, error: fetchError } = await supabase
              .from('challenges')
              .select('challenger_score, friend_score, challenger_username, friend_username')
              .eq('id', challengeId)
              .single();
            if (!fetchError && updatedChallenge) {
              console.log(`[Socket] Updated challenge row:`, updatedChallenge);
            } else {
              console.log(`[Socket] Error fetching updated challenge row: ${fetchError && fetchError.message}`);
            }
          }
        }
        // Emit latest challenge object to the room
        emitChallengeUpdate(io, challengeId);
      }
    } catch (err) {
      console.error('Error updating score:', err.message);
    }
    // Check if both players have answered
    const answers = challengeState[challengeId].answers[questionIndex];
    if (Object.keys(answers).length === 2) {
      // Both answered, proceed
      const nextIndex = challengeState[challengeId].currentIndex + 1;
      // For demo, assume 5 questions per challenge
      const isFinished = nextIndex >= 5;
      io.to(`challenge:${challengeId}`).emit('proceed', { nextIndex, finished: isFinished });
      if (!isFinished) {
        challengeState[challengeId].currentIndex = nextIndex;
        io.to(`challenge:${challengeId}`).emit('next_question', { questionIndex: nextIndex });
      } else {
        challengeState[challengeId].finished = true;
      }
    }
    // Emit latest challenge object to the room
    emitChallengeUpdate(io, challengeId);
  });

  // Manual next_question trigger (should be from server only)
  socket.on('next_question', ({ challengeId, questionIndex }) => {
    console.log(`[Socket] next_question for challenge ${challengeId}, question ${questionIndex}`);
    io.to(`challenge:${challengeId}`).emit('next_question', { questionIndex });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected');
    // Remove user from challengeRoomUsers
    for (const challengeId in challengeRoomUsers) {
      challengeRoomUsers[challengeId].delete(socket.username);
    }
    // Optionally clean up challengeState if needed
    // (not implemented for demo)
  });
});

// Patch: Listen for friend join via DB update and emit socket event
const expressApp = app;
expressApp.post('/challenge/:id/join', async (req, res, next) => {
  // After the DB update, emit to the room
  const { id } = req.params;
  try {
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && challenge && challenge.challenger_username && challenge.friend_username) {
      io.to(`challenge:${id}`).emit('both_ready');
      // Optionally, auto-start the challenge when both are ready
      // Set started=true in DB
      try {
        await supabase
          .from('challenges')
          .update({ started: true })
          .eq('id', id);
      } catch (err) {
        console.error('Failed to set started=true in DB:', err.message);
      }
      io.to(`challenge:${id}`).emit('start_challenge', { challengeId: id });
    }
  } catch {}
  next();
});

// Update CORS to allow all origins for deployment
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], credentials: true }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server (API + Socket.IO) listening on port ${PORT}`);
});
