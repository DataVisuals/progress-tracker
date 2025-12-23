import React, { useState, useEffect } from 'react';
import { FaTrophy, FaMedal } from 'react-icons/fa';
import { GiRaceCar } from 'react-icons/gi';
import { api } from '../api/client';
import { calculateHealthScore } from './ProjectHealthModal';
import './UserRace.css';

const UserRace = ({ users = [], projects = [], onClose }) => {
  const [raceStarted, setRaceStarted] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [userScores, setUserScores] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch audit log data
  useEffect(() => {
    const fetchAuditLog = async () => {
      try {
        const response = await api.getAuditLog({ limit: 1000 });
        setAuditLog(response.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load audit log:', err);
        setAuditLog([]);
        setLoading(false);
      }
    };
    fetchAuditLog();
  }, []);

  useEffect(() => {
    if (loading || users.length === 0 || projects.length === 0) return;

    // Filter out admin users from the race
    const nonAdminUsers = users.filter(user => user.role !== 'admin');

    // Calculate scores for each user using existing health scores
    const scores = nonAdminUsers.map(user => {
      // Count user interactions from audit log
      const interactions = auditLog.filter(log => log.user_id === user.id).length;

      // Get user's projects
      const userProjects = projects.filter(p => p.initiative_manager === user.name);

      let avgHealthScore = 0;
      if (userProjects.length > 0) {
        // Use the healthScore property if it exists on the projects
        // If not available, estimate based on project count (temporary fallback)
        const healthScores = userProjects.map(p => {
          if (p.healthScore !== undefined && p.healthScore !== null) {
            return p.healthScore;
          }
          // Fallback: estimate 60% health for projects without computed scores
          return 60;
        });
        avgHealthScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
      }

      // Final score: 40% interactions, 60% health score
      const score = (interactions * 0.4) + (avgHealthScore * 0.6);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        score,
        interactions,
        avgHealthScore,
        progress: 0
      };
    });

    // Sort by score to assign ranks
    const sortedScores = scores.sort((a, b) => b.score - a.score);

    // Take only top 10 users
    const top10Scores = sortedScores.slice(0, 10);

    // Assign ranks based on score
    const rankedScores = top10Scores.map((user, index) => ({
      ...user,
      rank: index + 1 // 1 = highest score (fastest)
    }));

    // Randomize display order
    const randomizedScores = [...rankedScores].sort(() => Math.random() - 0.5);

    setUserScores(randomizedScores);

    // Start race after brief delay
    setTimeout(() => setRaceStarted(true), 500);
  }, [loading, users, projects, auditLog]);

  useEffect(() => {
    if (!raceStarted || userScores.length === 0) return;

    // Animate cars to their final positions
    const animationDuration = 15000; // 15 seconds for very smooth animation
    const startTime = Date.now();

    // Generate random variation and speed wave for each user
    const userVariations = {};
    const userSpeedWaves = {};
    userScores.forEach(user => {
      userVariations[user.id] = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
      userSpeedWaves[user.id] = {
        frequency: Math.random() * 2 + 2, // Random frequency between 2-4 waves during race
        phase: Math.random() * Math.PI * 2, // Random starting phase
        amplitude: Math.random() * 0.15 + 0.1 // Random amplitude between 0.1-0.25
      };
    });

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const baseProgress = Math.min(elapsed / animationDuration, 1);

      setUserScores(prev => {
        // Find max score for calculating final positions
        const maxScore = Math.max(...prev.map(u => u.score));

        return prev.map(user => {
          // Speed based on rank (1 = fastest, higher numbers = slower)
          const speedMultiplier = 0.85 + ((user.rank - 1) * 0.05);

          // Dynamic speed variation using sine wave (cars slow down and speed up)
          const wave = userSpeedWaves[user.id];
          const speedWave = baseProgress < 0.85
            ? Math.sin(baseProgress * wave.frequency * Math.PI * 2 + wave.phase) * wave.amplitude
            : 0; // Remove wave in final stretch

          // Add excitement: random variation that decreases over time
          // Ensure variation is always positive to prevent reversing
          const variationFactor = baseProgress < 0.85
            ? Math.max(0.5, userVariations[user.id] + speedWave) // Clamp minimum to 0.5 to prevent reversal
            : userVariations[user.id] * (1 - ((baseProgress - 0.85) / 0.15)) + ((baseProgress - 0.85) / 0.15);

          // Final position based on score
          const finalPosition = maxScore > 0 ? (user.score / maxScore) * 88 : 50; // 0-88% of track, close to flag

          const userProgress = Math.min((baseProgress * variationFactor) / speedMultiplier, 1);

          // Calculate new progress and ensure it never goes backwards
          const currentProgress = user.progress;
          const newProgress = userProgress * finalPosition;
          const finalProgress = Math.max(currentProgress, newProgress);

          return {
            ...user,
            progress: finalProgress
          };
        });
      });

      if (baseProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Race finished, show results after a longer delay so users can see final positions
        setTimeout(() => setRaceFinished(true), 2000);
      }
    };

    requestAnimationFrame(animate);
  }, [raceStarted, userScores.length]);

  const handleClose = (e) => {
    if (e.key === 'Escape' || e.type === 'click') {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleClose);
    return () => window.removeEventListener('keydown', handleClose);
  }, []);

  const getCarColor = (index) => {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    return colors[index % colors.length];
  };

  const getMedalIcon = (rank) => {
    if (rank === 0) return <FaTrophy className="medal gold" />;
    if (rank === 1) return <FaMedal className="medal silver" />;
    if (rank === 2) return <FaMedal className="medal bronze" />;
    return null;
  };

  return (
    <div className="user-race-overlay" onClick={handleClose}>
      <div className="user-race-container" onClick={(e) => e.stopPropagation()}>
        <button className="race-close-btn" onClick={handleClose}>×</button>

        <div className="race-header">
          <h1>Track Championships</h1>
          <p>Based on interactions and project health scores</p>
        </div>

        {loading ? (
          <div className="race-loading">
            <div className="loading-spinner"></div>
            <p>Loading race data...</p>
          </div>
        ) : (
          <div className="race-track-container">
            {userScores.map((user, index) => (
              <div key={user.id} className="race-lane">
                <div className="lane-info">
                  <span className="user-name">{user.name}</span>
                  <span className="lane-pill">Lane {index + 1}</span>
                  <span className={`user-stats ${raceFinished ? 'visible' : ''}`}>
                    {user.interactions} interactions • {Math.round(user.avgHealthScore)}% health
                  </span>
                </div>

                <div className="lane-track">
                  <div className="track-line" />
                  <div
                    className={`race-car ${raceFinished ? 'finished' : ''}`}
                    style={{
                      left: `${user.progress}%`,
                      color: getCarColor(index)
                    }}
                  >
                    <GiRaceCar />
                  </div>
                  <div className="finish-line">🏁</div>
                </div>
              </div>
            ))}

            <div className={`race-results ${raceFinished ? 'visible' : ''}`}>
              <h2>Final Results</h2>
              <div className="podium">
                {userScores
                  .slice()
                  .sort((a, b) => a.rank - b.rank)
                  .slice(0, 3)
                  .map((user, index) => (
                    <div key={user.id} className={`podium-place place-${index + 1}`}>
                      {getMedalIcon(index)}
                      <div className="podium-name">{user.name}</div>
                      <div className="podium-score">{Math.round(user.score)} pts</div>
                    </div>
                  ))}
              </div>
              <div className="results-footer">
                Press <kbd>Esc</kbd> to close
              </div>
            </div>
          </div>
        )}

        <div className="race-footer">
          Press <kbd>Esc</kbd> or click outside to close
        </div>
      </div>
    </div>
  );
};

export default UserRace;
