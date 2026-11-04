import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { deriveRecallAnalytics } from './domain/recallAnalytics.js';

const WINDOWS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 60 days' },
  { value: 'all', label: 'All time' },
];

function formatDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  return new Date(value).toLocaleString();
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Duration unavailable';
  if (seconds < 60) return seconds + ' sec';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes + ' min ' + remaining + ' sec';
}

function gradeSummary(counts) {
  return counts.correct + ' correct · ' + counts.partial + ' partial · ' + counts.missed + ' missed';
}

function scoreLabel(score) {
  return score === null ? 'No graded attempts' : Math.round(score) + '% self-reported score';
}

function Stat({ label, value, helper }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={700}>{value}</Typography>
      {helper && <Typography variant="caption" color="text.secondary">{helper}</Typography>}
    </Paper>
  );
}

export default function RecallAnalyticsPanel({ recallData, palaces, onReviewNote, reviewError = '' }) {
  const [windowValue, setWindowValue] = useState(30);
  const analytics = useMemo(() => deriveRecallAnalytics(
    recallData,
    palaces,
    { lookbackDays: windowValue === 'all' ? null : windowValue },
  ), [recallData, palaces, windowValue]);

  return (
    <Paper variant="outlined" sx={{ mt: 2, p: { xs: 1.5, sm: 2.5 }, bgcolor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.14)' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Learning analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Derived from saved, self-reported recall attempts. These are not objective test scores or proof of delayed retention.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="analytics-window-label">History window</InputLabel>
          <Select
            labelId="analytics-window-label"
            label="History window"
            value={windowValue}
            onChange={(event) => setWindowValue(event.target.value === 'all' ? 'all' : Number(event.target.value))}
          >
            {WINDOWS.map((window) => (
              <MenuItem key={String(window.value)} value={window.value}>{window.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.25, mt: 2 }}>
        <Stat label="Sessions in window" value={analytics.totals.sessionCount} helper={analytics.totals.completedCount + ' completed · ' + analytics.totals.abandonedCount + ' abandoned'} />
        <Stat label="Scored exposures" value={analytics.totals.scoredAttemptCount} helper={gradeSummary(analytics.totals.counts)} />
        <Stat label="Current notes to review" value={analytics.frequentlyMissedItems.filter((item) => item.status === 'frequently_missed').length} helper="Fixed 5-exposure / 60-day rule" />
        <Stat label="High-confidence misses" value={analytics.highConfidenceMisses.length} helper="Separate observation, not a score adjustment" />
      </Box>

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Session history</Typography>
      {analytics.sessions.length === 0 ? (
        <Alert severity="info">No sessions are recorded in this time window. Start a guided session to begin building history; completed and abandoned sessions retain their full attempt records.</Alert>
      ) : (
        <Stack spacing={1}>
          {analytics.sessions.map((session) => (
            <Accordion key={session.id} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, width: '100%', pr: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700}>{session.routeName}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDate(session.startedAt)}</Typography>
                  </Box>
                  <Chip size="small" label={session.state.replace('_', ' ')} />
                  <Typography variant="body2" fontWeight={700}>{scoreLabel(session.scorePercent)}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Typography variant="body2">{gradeSummary(session.counts)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {session.scoredAttemptCount} graded of {session.recallStopCount} recall stops · {session.skippedCount} skipped · {formatDuration(session.durationSeconds)}
                  </Typography>
                  {session.attempts.map((attempt) => (
                    <Box key={attempt.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 140 }}>{attempt.promptSnapshot || 'Untitled memory'}</Typography>
                      <Chip size="small" label={attempt.grade} />
                      <Typography variant="caption" color="text.secondary">
                        {attempt.confidence ? attempt.confidence + ' confidence' : 'Confidence not recorded'} · {formatDate(attempt.attemptedAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Route performance over time</Typography>
      {analytics.routeHistory.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No route history is available for this window.</Typography>
      ) : (
        <Stack spacing={1}>
          {analytics.routeHistory.map((route) => (
            <Paper key={route.routeId} variant="outlined" sx={{ p: 1.5 }}>
              <Typography fontWeight={700}>{route.routeName}</Typography>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {route.sessions.map((session) => (
                  <Box key={session.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 150 }}>{formatDate(session.startedAt)}</Typography>
                    <Chip size="small" label={session.state.replace('_', ' ')} />
                    <Typography variant="body2">{scoreLabel(session.scorePercent)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Frequently missed notes</Typography>
      <Typography variant="caption" color="text.secondary">
        Current note revision only. Uses the latest 5 scored exposures in 60 days; at least 3 are required, with missed = 1 and partial = 0.5.
      </Typography>
      <Alert severity="info" sx={{ mt: 1 }}>
        Manual review only: choose a note to practise again at its original locus. This list does not assign due dates or infer an optimal review interval.
      </Alert>
      {reviewError && <Alert severity="error" sx={{ mt: 1 }}>{reviewError}</Alert>}
      {analytics.frequentlyMissedItems.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No current note revisions have scored exposures in the last 60 days.</Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {analytics.frequentlyMissedItems.map((item) => (
            <Paper key={item.palaceId + '::' + item.markerId} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.palaceName}</Typography>
                </Box>
                <Chip
                  size="small"
                  color={item.status === 'frequently_missed' ? 'warning' : 'default'}
                  label={item.status === 'frequently_missed' ? 'Frequently missed' : item.status === 'monitor' ? 'Monitor' : 'Not enough history'}
                />
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                {item.weightedMisses.toFixed(1)} weighted misses across {item.scoredExposures} of the latest 5 exposures · {Math.round(item.missRate * 100)}% miss rate
              </Typography>
              <Typography variant="caption" color="text.secondary">
                60-day lookback · 3-exposure minimum · {gradeSummary(item.counts)}
              </Typography>
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onReviewNote?.(item)}
                  disabled={!onReviewNote}
                  aria-label={'Review ' + item.title}
                >
                  Review at original locus
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Note revision history</Typography>
      <Typography variant="caption" color="text.secondary">
        Editing a note creates a separate content revision. Earlier attempts remain visible but are not mixed into the current-revision weakness calculation.
      </Typography>
      {analytics.itemRevisionHistory.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No item attempts are recorded in this time window.</Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {analytics.itemRevisionHistory.map((item) => (
            <Paper key={item.key} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700}>{item.prompt}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.palaceName}</Typography>
                </Box>
                <Chip size="small" label={item.isCurrentRevision ? 'Current revision' : 'Earlier revision'} />
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.75 }}>{gradeSummary(item.counts)}</Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {item.attempts.map((attempt) => (
                  <Typography key={attempt.id} variant="caption" color="text.secondary">
                    {formatDate(attempt.attemptedAt)} · {attempt.grade} · {attempt.confidence || 'confidence not recorded'}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>High-confidence misses</Typography>
      <Typography variant="caption" color="text.secondary">
        These are self-reported missed answers recorded with high confidence. They are displayed separately and do not change the miss-rate calculation.
      </Typography>
      {analytics.highConfidenceMisses.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No high-confidence misses are recorded in this time window.</Typography>
      ) : (
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {analytics.highConfidenceMisses.map((attempt) => (
            <Paper key={attempt.id} variant="outlined" sx={{ p: 1.25 }}>
              <Typography fontWeight={700}>{attempt.promptSnapshot || 'Untitled memory'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {attempt.palaceName} · {attempt.routeName} · {formatDate(attempt.attemptedAt)}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Skips and gateway navigation are excluded from scored exposure metrics. Confidence and self-grades are learner reports; this screen does not claim objective mastery or delayed retention.
      </Typography>
    </Paper>
  );
}
