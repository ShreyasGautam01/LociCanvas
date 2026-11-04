import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { createStableId } from './domain/palaceModel.js';
import { createRecallSessionSnapshot, validateRecallRoute } from './domain/recallModel.js';
import { upsertRecallSession } from './domain/recallStorage.js';
import GuidedRecallRunner from './GuidedRecallRunner.jsx';
import RecallAnalyticsPanel from './RecallAnalyticsPanel.jsx';
import { createManualReviewRoute } from './domain/recallReview.js';

const EMPTY_ROUTES = Object.freeze([]);

function getMarker(palaces, step) {
  const palace = palaces.find((candidate) => candidate.id === step.palaceId);
  const marker = palace?.items?.find((candidate) => candidate.id === step.markerId);
  return { palace, marker };
}

function getRouteValidation(route, palaces) {
  return validateRecallRoute(route, palaces);
}

function routeTime() {
  return new Date().toISOString();
}

export default function GuidedRecallManager({ palaces, recallData, onSave, onClose }) {
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [stepSelection, setStepSelection] = useState('');
  const [formError, setFormError] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const managerHeadingRef = useRef(null);
  const routeNameFieldRef = useRef(null);
  const returnedFromSessionRef = useRef(false);
  const isEditingDraft = Boolean(draft);

  const routes = Array.isArray(recallData?.routes) ? recallData.routes : EMPTY_ROUTES;
  const sessions = Array.isArray(recallData?.sessions) ? recallData.sessions : EMPTY_ROUTES;
  const inProgressSessions = useMemo(
    () => sessions.filter((session) => session?.state === 'in_progress')
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)),
    [sessions],
  );
  const routeStatuses = useMemo(
    () => new Map(routes.map((route) => [route.id, getRouteValidation(route, palaces)])),
    [routes, palaces],
  );

  useEffect(() => {
    managerHeadingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isEditingDraft) routeNameFieldRef.current?.focus();
  }, [isEditingDraft]);

  useEffect(() => {
    if (activeSession) {
      returnedFromSessionRef.current = true;
      return;
    }
    if (returnedFromSessionRef.current) {
      returnedFromSessionRef.current = false;
      managerHeadingRef.current?.focus();
    }
  }, [activeSession]);

  const availableSteps = useMemo(() => {
    if (!draft) return [];
    const lastStep = draft.steps.at(-1);
    const currentPalaceId = !lastStep
      ? null
      : lastStep.kind === 'gateway'
        ? lastStep.targetPalaceId
        : lastStep.palaceId;
    const availablePalaces = currentPalaceId
      ? palaces.filter((palace) => palace.id === currentPalaceId)
      : palaces;
    const usedRecallKeys = new Set(
      draft.steps
        .filter((step) => step.kind === 'recall')
        .map((step) => step.palaceId + '::' + step.markerId),
    );

    return availablePalaces.flatMap((palace) => (palace.items || []).flatMap((marker) => {
      if (marker.type === 'note') {
        if (usedRecallKeys.has(palace.id + '::' + marker.id)) return [];
        return [{
          value: JSON.stringify({
            kind: 'recall',
            palaceId: palace.id,
            markerId: marker.id,
          }),
          label: 'Recall · ' + palace.name + ' / ' + (marker.title || 'Untitled memory'),
        }];
      }
      if (marker.type === 'gateway' && lastStep) {
        const destination = palaces.find((candidate) => candidate.id === marker.targetId);
        if (!destination) return [];
        return [{
          value: JSON.stringify({
            kind: 'gateway',
            palaceId: palace.id,
            markerId: marker.id,
            targetPalaceId: marker.targetId,
          }),
          label: 'Gateway · ' + palace.name + ' / ' + (marker.title || 'Gateway') + ' → ' + destination.name,
        }];
      }
      return [];
    }));
  }, [draft, palaces]);

  const startNewRoute = () => {
    const now = routeTime();
    setSelectedRouteId(null);
    setDraft({
      id: createStableId('recall-route'),
      name: '',
      description: '',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      steps: [],
    });
    setStepSelection('');
    setFormError('');
  };

  const editRoute = (route) => {
    setSelectedRouteId(route.id);
    setDraft({
      ...route,
      steps: route.steps.map((step) => ({ ...step })),
    });
    setStepSelection('');
    setFormError('');
  };

  const updateDraft = (patch) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setFormError('');
  };

  const addStep = () => {
    if (!draft || !stepSelection) return;
    try {
      const selection = JSON.parse(stepSelection);
      const step = { id: createStableId('route-step'), ...selection };
      const next = { ...draft, steps: [...draft.steps, step] };
      setDraft(next);
      setStepSelection('');
      setFormError('');
    } catch {
      setFormError('Choose a valid memory or gateway marker before adding a step.');
    }
  };

  const moveStep = (index, offset) => {
    const destination = index + offset;
    if (!draft || destination < 0 || destination >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[destination]] = [steps[destination], steps[index]];
    updateDraft({ steps });
  };

  const removeStep = (stepId) => {
    if (!draft) return;
    updateDraft({ steps: draft.steps.filter((step) => step.id !== stepId) });
  };

  const saveDraft = () => {
    if (!draft) return;
    const candidate = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      updatedAt: routeTime(),
    };
    const validation = getRouteValidation(candidate, palaces);
    if (!validation.valid) {
      setFormError('This route cannot be saved yet. Resolve each validation issue below.');
      return;
    }

    const nextRoutes = routes.some((route) => route.id === candidate.id)
      ? routes.map((route) => route.id === candidate.id ? candidate : route)
      : [...routes, candidate];
    const nextData = { ...recallData, schemaVersion: 1, routes: nextRoutes };
    try {
      const saved = onSave(nextData);
      if (saved === false) {
        setFormError('The browser did not confirm that the route was saved. Your editor changes are still here.');
        return;
      }
      setSelectedRouteId(candidate.id);
      setDraft(null);
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The route could not be saved.');
    }
  };

  const deleteRoute = (route) => {
    if (!window.confirm('Delete the route "' + route.name + '"? Existing notes will not be deleted.')) return;
    const nextData = {
      ...recallData,
      schemaVersion: 1,
      routes: routes.filter((candidate) => candidate.id !== route.id),
    };
    try {
      const saved = onSave(nextData);
      if (saved === false) return;
      if (selectedRouteId === route.id) setSelectedRouteId(null);
      if (draft?.id === route.id) setDraft(null);
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The route could not be deleted.');
    }
  };

  const startSession = (route) => {
    try {
      const session = createRecallSessionSnapshot(route, palaces);
      const nextData = upsertRecallSession(recallData, session);
      const saved = onSave(nextData);
      if (saved === false) {
        setFormError('This session could not be saved. Check browser storage before starting.');
        return;
      }
      setSelectedRouteId(route.id);
      setDraft(null);
      setFormError('');
      setActiveSession(session);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'This route could not be started.');
    }
  };

  const startManualReview = (note) => {
    try {
      const now = routeTime();
      const route = createManualReviewRoute(palaces, {
        palaceId: note.palaceId,
        markerId: note.markerId,
        itemFingerprint: note.itemFingerprint,
        now,
      });
      const session = createRecallSessionSnapshot(route, palaces, { now });
      const saved = onSave(upsertRecallSession(recallData, session));
      if (saved === false) {
        setFormError('This review could not be saved. Check browser storage before starting.');
        return;
      }
      setSelectedRouteId(null);
      setDraft(null);
      setFormError('');
      setActiveSession(session);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'This note could not be reviewed.');
    }
  };

  const persistSession = (session) => {
    try {
      return onSave(upsertRecallSession(recallData, session));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Session progress could not be saved.');
      return false;
    }
  };

  const draftValidation = draft ? getRouteValidation(draft, palaces) : null;
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) || null;

  if (activeSession) {
    return (
      <GuidedRecallRunner
        key={activeSession.id}
        initialSession={activeSession}
        palaces={palaces}
        onPersist={persistSession}
        onExit={() => setActiveSession(null)}
      />
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: 'text.primary' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            ref={managerHeadingRef}
            id="guided-recall-dialog-title"
            component="h1"
            tabIndex={-1}
            variant="h5"
            fontWeight={700}
          >
            Guided Recall routes
          </Typography>
          <Typography id="guided-recall-dialog-description" variant="body2" color="text.secondary">
            Build a navigable path through existing memory and gateway markers.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button sx={{ minHeight: 44 }} variant={showAnalytics ? "contained" : "outlined"} onClick={() => setShowAnalytics((current) => !current)}>
            {showAnalytics ? "Hide learning analytics" : "Show learning analytics"}
          </Button>
          <Button sx={{ minHeight: 44 }} onClick={onClose} color="inherit">Close</Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Routes reference your existing notes. They do not copy or edit note content. Routes are saved only in this browser.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.85fr) minmax(0, 1.6fr)' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.12)' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Your routes ({routes.length})</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={startNewRoute}>New</Button>
          </Stack>
          {inProgressSessions.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Resume a session</Typography>
              <Stack spacing={1}>
                {inProgressSessions.map((session) => (
                  <Paper key={session.id} variant="outlined" sx={{ p: 1.25, borderColor: 'rgba(144,202,249,0.35)' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={600} noWrap>{session.routeNameSnapshot}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Step {Math.min(session.currentStepIndex + 1, session.routeSnapshot.length)} of {session.routeSnapshot.length}
                          {' · '}{session.attempts.length} graded · {session.skippedStepIds.length} skipped
                        </Typography>
                      </Box>
                      <Button size="small" variant="contained" onClick={() => setActiveSession(session)}>Resume</Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
            </Box>
          )}
          {routes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No routes yet. Create one to connect existing memory markers into a recall sequence.
            </Typography>
          )}
          <Stack spacing={1}>
            {routes.map((route) => {
              const validation = routeStatuses.get(route.id);
              const active = selectedRouteId === route.id && !draft;
              return (
                <Paper key={route.id} variant="outlined" sx={{
                  p: 1.25,
                  bgcolor: active ? 'rgba(165,214,167,0.09)' : 'transparent',
                  borderColor: active ? 'primary.main' : 'rgba(255,255,255,0.12)',
                }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} noWrap>{route.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {route.steps.filter((step) => step.kind === 'recall').length} recall stops · {route.steps.filter((step) => step.kind === 'gateway').length} gateways
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip size="small" color={validation?.valid ? 'success' : 'warning'} label={validation?.valid ? 'Ready' : 'Needs repair'} />
                      </Box>
                    </Box>
                    <IconButton aria-label={'Edit ' + route.name} size="small" sx={{ minWidth: 44, minHeight: 44 }} onClick={() => editRoute(route)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={'Delete ' + route.name} size="small" color="error" sx={{ minWidth: 44, minHeight: 44 }} onClick={() => deleteRoute(route)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.12)', minWidth: 0 }}>
          {draft ? (
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>{selectedRouteId ? 'Edit route' : 'Create route'}</Typography>
              <TextField
                inputRef={routeNameFieldRef}
                label="Route name"
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                inputProps={{ maxLength: 100 }}
                required
                fullWidth
              />
              <TextField
                label="Description (optional)"
                value={draft.description || ''}
                onChange={(event) => updateDraft({ description: event.target.value })}
                inputProps={{ maxLength: 500 }}
                multiline
                minRows={2}
                fullWidth
              />

              <Divider />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={700}>Ordered route steps</Typography>
                <Chip size="small" label={draft.steps.length + ' steps'} />
              </Stack>

              {draft.steps.length === 0 && (
                <Alert severity="info">Start by adding a recall stop. The first marker can be in any palace.</Alert>
              )}
              <Stack spacing={1}>
                {draft.steps.map((step, index) => {
                  const found = getMarker(palaces, step);
                  const isGateway = step.kind === 'gateway';
                  const destination = isGateway ? palaces.find((palace) => palace.id === step.targetPalaceId) : null;
                  return (
                    <Paper key={step.id} variant="outlined" sx={{ p: 1.25, borderColor: 'rgba(255,255,255,0.14)' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip size="small" label={index + 1} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={600} noWrap>
                            {found.marker?.title || (isGateway ? 'Missing gateway' : 'Missing memory')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {(found.palace?.name || 'Missing palace') + ' · ' + (isGateway ? 'Gateway' : 'Recall')}
                            {isGateway ? ' → ' + (destination?.name || 'Missing destination') : ''}
                          </Typography>
                        </Box>
                        <IconButton aria-label={'Move step ' + (index + 1) + ' up'} size="small" disabled={index === 0} onClick={() => moveStep(index, -1)}>
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton aria-label={'Move step ' + (index + 1) + ' down'} size="small" disabled={index === draft.steps.length - 1} onClick={() => moveStep(index, 1)}>
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton aria-label={'Remove step ' + (index + 1)} size="small" color="error" onClick={() => removeStep(step.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl fullWidth size="small">
                  <InputLabel id="recall-step-select-label">Add existing marker</InputLabel>
                  <Select
                    labelId="recall-step-select-label"
                    label="Add existing marker"
                    value={stepSelection}
                    onChange={(event) => setStepSelection(event.target.value)}
                  >
                    {availableSteps.length === 0 && <MenuItem disabled value="">No reachable markers available</MenuItem>}
                    {availableSteps.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={addStep} disabled={!stepSelection} sx={{ flexShrink: 0 }}>
                  Add step
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                After a recall stop, you may add another note in the same palace or a gateway leaving that palace. After a gateway, the next marker must be in its destination.
              </Typography>

              {draftValidation && !draftValidation.valid && (
                <Alert severity="warning">
                  <Typography fontWeight={700} sx={{ mb: 0.5 }}>Route validation</Typography>
                  <Box component="ul" sx={{ my: 0, pl: 2 }}>
                    {draftValidation.errors.map((error, index) => (
                      <li key={error.code + '-' + error.path + '-' + index}>
                        <Typography variant="body2">{error.message}</Typography>
                      </li>
                    ))}
                  </Box>
                </Alert>
              )}
              {formError && <Alert severity="error">{formError}</Alert>}
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button color="inherit" onClick={() => { setDraft(null); setFormError(''); }}>Cancel</Button>
                <Button variant="contained" onClick={saveDraft} disabled={!draftValidation?.valid}>Save route</Button>
              </Stack>
            </Stack>
          ) : selectedRoute ? (
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={700}>{selectedRoute.name}</Typography>
              {selectedRoute.description && <Typography color="text.secondary">{selectedRoute.description}</Typography>}
              <Chip
                size="small"
                sx={{ alignSelf: 'flex-start' }}
                color={routeStatuses.get(selectedRoute.id)?.valid ? 'success' : 'warning'}
                label={routeStatuses.get(selectedRoute.id)?.valid ? 'Valid route' : 'Needs repair'}
              />
              <Divider />
              <Typography variant="body2" color="text.secondary">
                {selectedRoute.steps.length} ordered steps. {selectedRoute.steps.filter((step) => step.kind === 'recall').length} recall stops and {selectedRoute.steps.filter((step) => step.kind === 'gateway').length} gateway transitions.
              </Typography>
              {!routeStatuses.get(selectedRoute.id)?.valid && (
                <Alert severity="warning">
                  {routeStatuses.get(selectedRoute.id)?.errors.map((error) => error.message).join(' ')}
                </Alert>
              )}
              {formError && <Alert severity="error">{formError}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  onClick={() => startSession(selectedRoute)}
                  disabled={!routeStatuses.get(selectedRoute.id)?.valid}
                >
                  Start recall
                </Button>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => editRoute(selectedRoute)}>Edit route</Button>
              </Stack>
            </Stack>
          ) : (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography variant="h6">Create a recall route</Typography>
              <Typography color="text.secondary" sx={{ my: 1 }}>
                Choose a sequence of existing notes and gateway transitions. A valid route starts and ends with a recall stop.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={startNewRoute}>Create route</Button>
            </Box>
          )}
        </Paper>
      </Box>
      {showAnalytics && (
        <RecallAnalyticsPanel
          recallData={recallData}
          palaces={palaces}
          onReviewNote={startManualReview}
          reviewError={formError}
        />
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Routes, active session snapshots, and self-reported attempts are saved locally. Session summaries are shown when a run is completed.
      </Typography>
    </Box>
  );
}
