import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForward as AdvanceIcon,
  CheckCircle as CheckCircleIcon,
  ExitToApp as ExitToAppIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  abandonRecallSession,
  advanceRecallSession,
  calculateRecallSessionScore,
  recordRecallAttempt,
  skipRecallStep,
} from './domain/recallModel.js';

function getCurrentLocation(session, step, palaces) {
  const locationSnapshot = session.locationSnapshots?.find((item) => item.routeStepId === step?.id);
  const palace = palaces.find((item) => item.id === step?.palaceId);
  const marker = palace?.items?.find((item) => item.id === step?.markerId);

  return {
    palaceName: locationSnapshot?.palaceNameSnapshot || palace?.name || 'Environment unavailable',
    backgroundImage: palace?.imageUrl || '',
    markerTitle: locationSnapshot?.markerTitleSnapshot || marker?.title || 'Memory location',
    x: locationSnapshot?.markerXSnapshot ?? marker?.x ?? 50,
    y: locationSnapshot?.markerYSnapshot ?? marker?.y ?? 50,
  };
}

function getDestinationName(session, step, palaces) {
  const snapshot = session.locationSnapshots?.find((item) => item.routeStepId === step?.id);
  return snapshot?.targetPalaceNameSnapshot
    || palaces.find((item) => item.id === step?.targetPalaceId)?.name
    || 'Destination unavailable';
}

function LocationScene({ location, label }) {
  return (
    <Box
      role="img"
      aria-label={label + ' in ' + location.palaceName}
      sx={{
        position: 'relative',
        minHeight: { xs: 190, sm: 250 },
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.16)',
        backgroundColor: '#202a31',
        backgroundImage: location.backgroundImage
          ? 'linear-gradient(rgba(8,12,18,0.18), rgba(8,12,18,0.45)), url("' + location.backgroundImage + '")'
          : 'radial-gradient(circle at 50% 45%, #35464c, #121920 72%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: location.x + '%',
          top: location.y + '%',
          transform: 'translate(-50%, -50%)',
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '3px solid #fff',
          background: 'rgba(165,214,167,0.85)',
          boxShadow: '0 0 0 9px rgba(165,214,167,0.2), 0 0 28px rgba(165,214,167,0.8)',
        }}
      />
      <Box sx={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
      }}>
        <Chip size="small" label={location.palaceName} sx={{ bgcolor: 'rgba(0,0,0,0.68)', color: 'white' }} />
        <Typography variant="caption" sx={{ px: 1, py: 0.5, bgcolor: 'rgba(0,0,0,0.68)', borderRadius: 1, color: 'white' }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

export default function GuidedRecallRunner({ initialSession, palaces, onPersist, onExit }) {
  const [session, setSession] = useState(initialSession);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [confidence, setConfidence] = useState('');
  const [confidenceSkipped, setConfidenceSkipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [typedResponse, setTypedResponse] = useState('');
  const [storageError, setStorageError] = useState('');
  const [actionError, setActionError] = useState('');

  const currentStep = session.routeSnapshot[session.currentStepIndex] || null;
  const currentIndex = session.currentStepIndex;
  const stepNumber = Math.min(currentIndex + 1, session.routeSnapshot.length);
  const location = currentStep ? getCurrentLocation(session, currentStep, palaces) : null;
  const recallSnapshot = currentStep?.kind === 'recall'
    ? session.recallSnapshots.find((item) => item.routeStepId === currentStep.id)
    : null;
  const alreadyAttempted = Boolean(currentStep && session.attempts.some((attempt) => attempt.routeStepId === currentStep.id));
  const alreadySkipped = Boolean(currentStep && session.skippedStepIds.includes(currentStep.id));
  const hasOutcome = alreadyAttempted || alreadySkipped;
  const score = calculateRecallSessionScore(session);

  const persistSession = (nextSession) => {
    try {
      const saved = onPersist(nextSession);
      if (saved === false) {
        setStorageError('This session change could not be saved. Your previous saved progress is unchanged. Export a backup or free browser storage before continuing.');
        return false;
      }
      setSession(nextSession);
      setStorageError('');
      setActionError('');
      return true;
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'This session change could not be saved.');
      return false;
    }
  };

  const resetRecallInteraction = () => {
    setHasAttempted(false);
    setConfidence('');
    setConfidenceSkipped(false);
    setRevealed(false);
    setTypedResponse('');
  };

  const handleGrade = (grade) => {
    if (!currentStep || currentStep.kind !== 'recall' || !revealed || hasOutcome) return;
    try {
      const updated = recordRecallAttempt(session, {
        routeStepId: currentStep.id,
        grade,
        confidence: confidence || null,
        attemptedAt: new Date().toISOString(),
      });
      persistSession(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The self-grade could not be recorded.');
    }
  };

  const handleSkip = () => {
    if (!currentStep || currentStep.kind !== 'recall' || hasOutcome) return;
    try {
      const updated = skipRecallStep(session, { routeStepId: currentStep.id });
      persistSession(updated);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'This recall stop could not be skipped.');
    }
  };

  const handleContinue = () => {
    try {
      const updated = advanceRecallSession(session);
      if (persistSession(updated)) resetRecallInteraction();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The session could not advance.');
    }
  };

  const handleEnterGateway = () => {
    try {
      const updated = advanceRecallSession(session, { gatewayEntered: true });
      if (persistSession(updated)) resetRecallInteraction();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The gateway could not be entered.');
    }
  };

  const handleAbandon = () => {
    if (!window.confirm('Abandon this session? Grades already saved will be preserved; the current ungraded stop will not count as a miss.')) return;
    try {
      const updated = abandonRecallSession(session);
      if (persistSession(updated)) onExit();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The session could not be abandoned.');
    }
  };

  if (session.state === 'completed' || session.state === 'abandoned') {
    const completed = session.state === 'completed';
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2} sx={{ maxWidth: 760, mx: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="overline" color="primary">GUIDED RECALL RESULT</Typography>
            <Button color="inherit" onClick={onExit}>Back to routes</Button>
          </Stack>
          <Typography variant="h4" fontWeight={700}>{completed ? 'Session completed' : 'Session abandoned'}</Typography>
          <Typography color="text.secondary">{session.routeNameSnapshot}</Typography>
          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.025)' }}>
            <Stack spacing={1.5}>
              <Typography variant="h3" fontWeight={700} color="primary">
                {score.scorePercent === null ? '—' : Math.round(score.scorePercent) + '%'}
              </Typography>
              <Typography variant="body2" color="text.secondary">Self-reported recall score · {score.scoredAttemptCount} scored stops</Typography>
              <Divider />
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip color="success" label={'Correct: ' + score.counts.correct} />
                <Chip color="warning" label={'Partial: ' + score.counts.partial} />
                <Chip color="error" label={'Missed: ' + score.counts.missed} />
                <Chip label={'Skipped: ' + score.skippedCount} />
                <Chip label={'Recall stops: ' + score.recallStopCount} />
              </Stack>
            </Stack>
          </Paper>
          <Alert severity="info">
            These results are based on your own grades. They are not an automated assessment of answer correctness.
          </Alert>
          <Button variant="contained" onClick={onExit}>Return to routes</Button>
        </Stack>
      </Box>
    );
  }

  if (!currentStep || !location || !recallSnapshot && currentStep.kind === 'recall') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">This saved session is incomplete and cannot be continued safely. Your saved attempts have not been deleted.</Alert>
        <Button sx={{ mt: 2 }} onClick={onExit}>Back to routes</Button>
      </Box>
    );
  }

  const isRecall = currentStep.kind === 'recall';
  const destinationName = !isRecall ? getDestinationName(session, currentStep, palaces) : '';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: 'text.primary' }}>
      <Stack spacing={2} sx={{ maxWidth: 920, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="overline" color="primary">GUIDED RECALL SESSION</Typography>
            <Typography variant="h5" fontWeight={700}>{session.routeNameSnapshot}</Typography>
            <Typography variant="body2" color="text.secondary">
              Step {stepNumber} of {session.routeSnapshot.length} · {session.attempts.length} graded · {session.skippedStepIds.length} skipped
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button color="inherit" startIcon={<ExitToAppIcon />} onClick={onExit}>Exit to routes</Button>
            <Button color="error" onClick={handleAbandon}>Abandon</Button>
          </Stack>
        </Stack>

        <Box sx={{ height: 6, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <Box sx={{
            height: '100%',
            width: (session.currentStepIndex / session.routeSnapshot.length * 100) + '%',
            bgcolor: 'primary.main',
            transition: 'width 180ms ease-out',
          }} />
        </Box>

        <LocationScene location={location} label={isRecall ? 'Recall locus' : 'Gateway location'} />

        {isRecall ? (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <Stack spacing={2}>
              <Chip color="primary" size="small" label="Recall stop" sx={{ alignSelf: 'flex-start' }} />
              <Typography variant="overline" color="text.secondary">RECALL CUE</Typography>
              <Typography variant="h4" fontWeight={700}>{recallSnapshot.promptSnapshot || 'Untitled memory'}</Typography>

              {!hasOutcome && !revealed && (
                <Stack spacing={1.5}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={5}
                    label="Your recalled answer (optional; not saved)"
                    value={typedResponse}
                    onChange={(event) => setTypedResponse(event.target.value)}
                  />
                  {!hasAttempted ? (
                    <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={() => setHasAttempted(true)}>
                      I've attempted recall
                    </Button>
                  ) : (
                    <Alert severity="info">Recall attempt registered for this step. Set your confidence before revealing the saved note.</Alert>
                  )}
                  {hasAttempted && (
                    <FormControl>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>How confident were you in the answer you just recalled?</Typography>
                      <RadioGroup
                        row
                        value={confidence}
                        onChange={(event) => { setConfidence(event.target.value); setConfidenceSkipped(false); }}
                      >
                        {['low', 'medium', 'high'].map((level) => (
                          <FormControlLabel key={level} value={level} control={<Radio />} label={level[0].toUpperCase() + level.slice(1)} />
                        ))}
                      </RadioGroup>
                      <Button
                        size="small"
                        color="inherit"
                        sx={{ alignSelf: 'flex-start' }}
                        onClick={() => { setConfidence(''); setConfidenceSkipped(true); }}
                      >
                        Skip confidence rating
                      </Button>
                    </FormControl>
                  )}
                  <Button
                    variant="contained"
                    startIcon={<VisibilityIcon />}
                    onClick={() => setRevealed(true)}
                    disabled={!hasAttempted || (!confidence && !confidenceSkipped)}
                  >
                    Reveal answer
                  </Button>
                  <Button color="inherit" onClick={handleSkip} sx={{ alignSelf: 'flex-start' }}>
                    Skip this stop (no attempt)
                  </Button>
                </Stack>
              )}

              {revealed && !hasOutcome && (
                <Stack spacing={2}>
                  <Alert severity="success">Answer revealed. Compare it with what you recalled, then report your own grade.</Alert>
                  <Paper sx={{ p: 2, bgcolor: 'rgba(165,214,167,0.08)', border: '1px solid rgba(165,214,167,0.25)' }}>
                    <Typography variant="overline" color="primary">SAVED NOTE CONTENT</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {recallSnapshot.answerSnapshot || 'This note has no saved answer content.'}
                    </Typography>
                  </Paper>
                  <Typography variant="subtitle2">How well did you recall it? (Self-reported)</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                    <Button color="success" variant="outlined" onClick={() => handleGrade('correct')}>Correct</Button>
                    <Button color="warning" variant="outlined" onClick={() => handleGrade('partial')}>Partially recalled</Button>
                    <Button color="error" variant="outlined" onClick={() => handleGrade('missed')}>Missed</Button>
                  </Stack>
                </Stack>
              )}

              {hasOutcome && (
                <Stack spacing={1.5}>
                  <Alert severity="success">
                    {alreadySkipped
                      ? 'This stop was explicitly skipped. It will not count as a failed recall.'
                      : 'Your self-reported grade is saved: ' + (session.attempts.find((attempt) => attempt.routeStepId === currentStep.id)?.grade || 'recorded') + '.'}
                  </Alert>
                  <Button variant="contained" endIcon={<AdvanceIcon />} onClick={handleContinue}>Continue</Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <Stack spacing={2}>
              <Chip color="secondary" size="small" label="Navigation step" sx={{ alignSelf: 'flex-start' }} />
              <Typography variant="h5" fontWeight={700}>{location.markerTitle}</Typography>
              <Typography color="text.secondary">This gateway leads to <strong>{destinationName}</strong>.</Typography>
              <Alert severity="info">Entering a gateway is navigation, not a recall attempt. It does not affect the score.</Alert>
              <Button variant="contained" onClick={handleEnterGateway}>Enter gateway to {destinationName}</Button>
            </Stack>
          </Paper>
        )}

        {storageError && <Alert severity="error">{storageError}</Alert>}
        {actionError && <Alert severity="warning">{actionError}</Alert>}
        <Typography variant="caption" color="text.secondary">
          Your optional typed response stays in memory only and is discarded when you leave this recall stop. Session progress is saved locally in this browser.
        </Typography>
      </Stack>
    </Box>
  );
}
