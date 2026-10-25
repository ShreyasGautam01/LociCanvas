import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createStableId, isValidHttpsUrl, parsePalaceStorage, pointerToCanvasPercent, moveMarkerInPalaces, serializePalaceStorage } from './domain/palaceModel.js';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  TextField,
  Button,
  AppBar,
  Toolbar,
  Paper,
  Tooltip,
  Fade,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Fab,
  Breadcrumbs,
  ThemeProvider,
  createTheme,
  CssBaseline,
  GlobalStyles,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Book as BookIcon,
  Collections as CollectionsIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Lightbulb as LightbulbIcon,
  Launch as GatewayIcon,
  Delete as DeleteIcon,
  Note as NoteIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedDiv = motion.div;

// --- COLOR PALETTE ---
const ACCENT_COLORS = [
  { name: 'Sage', hex: '#a5d6a7' },
  { name: 'Sky', hex: '#90caf9' },
  { name: 'Lavender', hex: '#ce93d8' },
  { name: 'Amber', hex: '#ffe082' },
  { name: 'Rose', hex: '#ef9a9a' },
  { name: 'Teal', hex: '#80cbc4' },
  { name: 'Slate', hex: '#b0bec5' },
  { name: 'Coral', hex: '#ffccbc' }
];

const DEFAULT_THEME_COLOR = '#a5d6a7';

// --- THEME ---
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: DEFAULT_THEME_COLOR },
    secondary: { main: '#90caf9' },
    background: { default: '#0a0e14', paper: '#1a1f26' },
    error: { main: '#ef5350' }
  },
  typography: {
    fontFamily: '"Quicksand", "Roboto", "sans-serif"',
    h4: { fontWeight: 700 },
  },
  shape: { borderRadius: 16 },
});

// --- CONSTANTS ---
const STORAGE_KEY = 'locicanvas_v2_data';
const RECOVERY_KEY = 'locicanvas_v2_data_recovery';

function loadSavedPalaces() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { palaces: INITIAL_DATA, issue: '' };
    try {
      return { palaces: parsePalaceStorage(saved), issue: '' };
    } catch {
      try { localStorage.setItem(RECOVERY_KEY, saved); } catch { /* Storage may be unavailable. */ }
      return { palaces: INITIAL_DATA, issue: 'Saved data could not be read. A recovery copy was preserved when browser storage allowed it; the sample collection is loaded until the saved data is recovered.' };
    }
  } catch {
    return { palaces: INITIAL_DATA, issue: 'Browser storage is unavailable. Changes may not persist after this session.' };
  }
}
const INITIAL_DATA = [
  {
    id: 'root',
    name: 'The Grand Library',
    imageUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=2000',
    items: [
      { id: 'note-1', type: 'note', x: 30, y: 45, title: 'Philosophy of Loci', content: 'The method of loci is a strategy for memory enhancement...', color: '#ffe082' },
      { 
        id: 'gateway-1', 
        type: 'gateway', 
        x: 75, 
        y: 60, 
        title: 'Gateway to Study Desk',
        targetId: 'desk',
        color: '#a5d6a7'
      }
    ]
  },
  {
    id: 'desk',
    name: 'The Oak Desk',
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=2000',
    items: [
      { id: 'note-2', type: 'note', x: 20, y: 30, title: 'Draft Paper', content: 'Finish the project.', color: '#ef9a9a' }
    ]
  }
];

// --- HELPER COMPONENTS ---
const GlassCard = ({ children, sx }) => (
  <Paper elevation={0} sx={{ background: 'rgba(26, 31, 38, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', p: 2, ...sx }}>
    {children}
  </Paper>
);

const Marker = ({ item, onClick, isEditMode, onDelete, onMove }) => {
  const dragRef = useRef(null);
  const isGateway = item.type === 'gateway';
  const itemColor = item.color || DEFAULT_THEME_COLOR;
  
  return (
    <AnimatedDiv
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.2, zIndex: 100 }}
      style={{ position: 'absolute', top: `${item.y}%`, left: `${item.x}%`, transform: 'translate(-50%, -50%)', cursor: isEditMode ? 'grab' : 'pointer', touchAction: isEditMode ? 'none' : 'auto', zIndex: 10 }}
      onPointerDown={(event) => {
        if (!isEditMode || event.button !== 0 || event.target.closest('button')) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!isEditMode || !drag || drag.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) drag.moved = true;
        if (!drag.moved) return;
        const rect = event.currentTarget.parentElement?.getBoundingClientRect();
        const position = pointerToCanvasPercent(event.clientX, event.clientY, rect);
        if (position) onMove(item.id, position.x, position.y);
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onClick={(e) => {
        e.stopPropagation();
        if (dragRef.current?.moved) {
          dragRef.current = null;
          return;
        }
        dragRef.current = null;
        onClick(item);
      }}
    >
      <Tooltip title={isEditMode ? `${item.title} (Right-click to delete)` : item.title} arrow>
        <Box sx={{ 
          width: isGateway ? 48 : 28, height: isGateway ? 48 : 28, borderRadius: '50%', 
          bgcolor: alpha(itemColor, 0.2), 
          boxShadow: `0 0 15px ${itemColor}`, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          border: `2px solid ${itemColor}`, backdropFilter: 'blur(4px)',
          transition: 'all 0.3s ease'
        }}>
          {isGateway ? <GatewayIcon sx={{ fontSize: 24, color: itemColor }} /> : <LightbulbIcon sx={{ fontSize: 16, color: itemColor }} />}
        </Box>
      </Tooltip>
      {isEditMode && (
        <IconButton 
          size="small" 
          sx={{ position: 'absolute', top: -12, right: -12, bgcolor: 'error.main', width: 22, height: 22, '&:hover': { bgcolor: 'error.dark' }, zIndex: 101 }} 
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
        >
          <DeleteIcon sx={{ fontSize: 14, color: 'white' }} />
        </IconButton>
      )}
    </AnimatedDiv>
  );
};

// --- MAIN APPLICATION ---
export default function App() {
  // --- GLOBAL DATA STATE ---
  const [initialStorage] = useState(() => loadSavedPalaces());
  const [palaces, setPalaces] = useState(initialStorage.palaces);
  const [storageIssue, setStorageIssue] = useState(initialStorage.issue);
  
  // --- NAVIGATION STATE ---
  const [navStack, setNavStack] = useState(() => [initialStorage.palaces[0]?.id || 'root']);
  const currentLevelId = navStack[navStack.length - 1];
  const currentLevel = useMemo(() => palaces.find(p => p.id === currentLevelId) || palaces[0], [palaces, currentLevelId]);

  // --- UI STATE ---
  const [editMode, setEditMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealState, setRevealState] = useState({ palaceId: null, level: 0 });
  const revealLevel = revealState.palaceId === currentLevelId ? revealState.level : 0;

  // --- INTERACTION STATE ---
  const [contextMenu, setContextMenu] = useState(null); // { mouseX, mouseY }
  const [clickPos, setClickPos] = useState(null); // { x, y } (percentage)
  
  // --- DIALOGS STATE ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // The item object being edited
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false); // Palace settings
  const [newEnvironmentOpen, setNewEnvironmentOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferText, setTransferText] = useState('');
  const [transferError, setTransferError] = useState('');

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    if (initialStorage.issue && palaces === initialStorage.palaces) return;

    let nextIssue = '';
    try {
      localStorage.setItem(STORAGE_KEY, serializePalaceStorage(palaces));
    } catch {
      nextIssue = 'Changes could not be saved to browser storage. Export or copy important content before leaving this page.';
    }

    const statusTimer = setTimeout(() => setStorageIssue(nextIssue), 0);
    return () => clearTimeout(statusTimer);
  }, [palaces, initialStorage]);

  // --- REVEAL ANIMATION ---
  useEffect(() => {
    const t1 = setTimeout(() => setRevealState({ palaceId: currentLevelId, level: 1 }), 300);
    const t2 = setTimeout(() => setRevealState({ palaceId: currentLevelId, level: 2 }), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [currentLevelId]);

  // --- CORE LOGIC: CANVAS CLICKS ---
  const handleCanvasClick = (event) => {
    if (!editMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = pointerToCanvasPercent(event.clientX, event.clientY, rect);
    if (!position) return;
    setClickPos(position);
    setContextMenu(contextMenu === null ? { mouseX: event.clientX - 2, mouseY: event.clientY - 4 } : null);
  };

  const initiateCreate = (type) => {
    setContextMenu(null);
    if (type === 'note') {
      const newItem = {
        id: `note-${Date.now()}`,
        type: 'note',
        x: clickPos.x,
        y: clickPos.y,
        title: '',
        content: '',
        color: DEFAULT_THEME_COLOR
      };
      setEditingItem(newItem);
      setEditorOpen(true);
    } else if (type === 'gateway') {
      setGatewayDialogOpen(true);
    }
  };

  // --- CORE LOGIC: DATA UPDATES ---
  const handleSaveNote = (itemData) => {
    setPalaces(prev => prev.map(p => {
      if (p.id !== currentLevelId) return p;
      const exists = p.items.find(i => i.id === itemData.id);
      return exists 
        ? { ...p, items: p.items.map(i => i.id === itemData.id ? itemData : i) }
        : { ...p, items: [...p.items, itemData] };
    }));
    setEditorOpen(false);
    setEditingItem(null);
  };

  const handleMoveMarker = (itemId, x, y) => {
    setPalaces((prev) => moveMarkerInPalaces(prev, currentLevelId, itemId, x, y));
  };

  const handleDeleteItem = (itemId) => {
    if (window.confirm("Delete this memory permanently?")) {
      setPalaces(prev => prev.map(p => 
        p.id === currentLevelId 
          ? { ...p, items: p.items.filter(i => i.id !== itemId) } 
          : p
      ));
      setEditorOpen(false); // Close editor if open
    }
  };

  const handleCreateGateway = (targetPalaceId, isNew = false, newPalaceName = '', newPalaceUrl = '') => {
    if (!clickPos) return;
    if (isNew && (!newPalaceName.trim() || !isValidHttpsUrl(newPalaceUrl, true))) {
      setStorageIssue('Enter an environment name and a valid HTTPS image URL, or leave the URL empty.');
      return;
    }
    if (!isNew && (!targetPalaceId || !palaces.some(p => p.id === targetPalaceId) || targetPalaceId === currentLevelId)) {
      setStorageIssue('Choose a valid destination environment for this gateway.');
      return;
    }
    let finalTargetId = targetPalaceId;
    setPalaces(prev => {
      let newState = [...prev];
      if (isNew) {
        finalTargetId = createStableId('palace');
        const newPalace = {
          id: finalTargetId,
          name: newPalaceName,
          imageUrl: newPalaceUrl || 'https://images.unsplash.com/photo-1516528387618-afa90b13e000?auto=format&fit=crop&q=80&w=2000',
          items: []
        };
        newState.push(newPalace);
      }
      const gatewayItem = {
        id: createStableId('gateway'),
        type: 'gateway',
        x: clickPos.x,
        y: clickPos.y,
        title: isNew ? `Gateway to ${newPalaceName}` : 'Gateway',
        targetId: finalTargetId,
        color: DEFAULT_THEME_COLOR
      };
      return newState.map(p => p.id === currentLevelId ? { ...p, items: [...p.items, gatewayItem] } : p);
    });
    setGatewayDialogOpen(false);
  };

  // --- CORE LOGIC: ENVIRONMENT SETTINGS ---
  const handleUpdateEnvironment = (newName, newUrl) => {
    const trimmedName = newName.trim();
    if (!trimmedName || !isValidHttpsUrl(newUrl, true)) {
      setStorageIssue('Use a non-empty environment name and an HTTPS background image URL (or leave the URL empty).');
      return;
    }
    setPalaces(prev => prev.map(p => p.id === currentLevelId ? { ...p, name: trimmedName, imageUrl: newUrl.trim() } : p));
    setSettingsOpen(false);
  };

  const handleExport = () => {
    try {
      const blob = new Blob([serializePalaceStorage(palaces)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'locicanvas-backup.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStorageIssue('Backup exported.');
    } catch {
      setStorageIssue('Export failed. Copy your data before leaving this page.');
    }
  };

  const handleImport = () => {
    try {
      const imported = parsePalaceStorage(transferText);
      if (!window.confirm('Import replaces the current local collection. Export a backup first if you need the current collection. Continue?')) return;
      setPalaces(imported);
      setNavStack([imported[0].id]);
      setTransferOpen(false);
      setTransferText('');
      setTransferError('');
      setStorageIssue('Collection imported.');
    } catch {
      setTransferError('This is not a valid LociCanvas backup. No data was changed.');
    }
  };

  const handleRestoreRecovery = () => {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) {
        setStorageIssue('No recovery copy was found in this browser.');
        return;
      }
      const recovered = parsePalaceStorage(raw);
      if (!window.confirm('Restore the preserved recovery copy? Export a backup first if needed.')) return;
      setPalaces(recovered);
      setNavStack([recovered[0].id]);
      setStorageIssue('Recovery copy restored.');
    } catch {
      setStorageIssue('The preserved recovery copy is invalid and could not be restored.');
    }
  };

  const handleCreateNewEnvironment = (name, url) => {
    const trimmedName = name.trim();
    if (!trimmedName || !isValidHttpsUrl(url, true)) {
      setStorageIssue('Use a non-empty environment name and an HTTPS background image URL (or leave the URL empty).');
      return;
    }
    const newId = createStableId('palace');
    const newPalace = {
      id: newId,
      name: trimmedName,
      imageUrl: url.trim() || 'https://images.unsplash.com/photo-1516528387618-afa90b13e000?auto=format&fit=crop&q=80&w=2000',
      items: [],
    };
    setPalaces((prev) => [...prev, newPalace]);
    setNavStack([newId]);
    setNewEnvironmentOpen(false);
    setSidebarOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ 
        'html, body, #root': { margin: 0, padding: 0, width: '100vw', height: '100vh', overflow: 'hidden', bgcolor: '#0a0e14' },
        '::selection': { background: alpha(DEFAULT_THEME_COLOR, 0.3), color: '#fff' }
      }} />
      
      <Box sx={{ height: '100vh', width: '100vw', position: 'relative' }}>
        
        {/* --- HEADER --- */}
        <AppBar position="absolute" sx={{ background: 'transparent', boxShadow: 'none', top: 20, pointerEvents: 'none' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pointerEvents: 'auto' }}>
              <IconButton onClick={() => setSidebarOpen(true)} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'primary.main', color: 'black' } }}>
                <CollectionsIcon />
              </IconButton>
              <GlassCard sx={{ py: 0.5, px: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Breadcrumbs separator={<Typography sx={{ color: 'white', opacity: 0.5 }}>/</Typography>}>
                  {navStack.map((id, i) => {
                    const p = palaces.find(x => x.id === id);
                    return (
                      <Typography key={id} sx={{ 
                        color: i === navStack.length - 1 ? 'primary.main' : 'white', 
                        fontWeight: i === navStack.length - 1 ? 700 : 400,
                        cursor: i < navStack.length - 1 ? 'pointer' : 'default'
                      }} onClick={() => i < navStack.length - 1 && setNavStack(navStack.slice(0, i + 1))}>
                        {p?.name || 'Unknown'}
                      </Typography>
                    );
                  })}
                </Breadcrumbs>
                <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: 'white', opacity: 0.7 }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </GlassCard>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
              <Tooltip title="Export backup"><IconButton aria-label="Export backup" onClick={handleExport} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}><DownloadIcon /></IconButton></Tooltip>
              <Tooltip title="Import backup"><IconButton aria-label="Import backup" onClick={() => { setTransferText(''); setTransferError(''); setTransferOpen(true); }} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}><UploadIcon /></IconButton></Tooltip>
              <Button 
                variant="contained" 
                startIcon={<EditIcon />} 
                onClick={() => setEditMode(!editMode)} 
                sx={{ 
                  borderRadius: 10, 
                  bgcolor: editMode ? 'error.main' : 'rgba(255,255,255,0.1)', 
                  backdropFilter: 'blur(10px)',
                  boxShadow: editMode ? '0 0 20px rgba(239, 83, 80, 0.4)' : 'none',
                  '&:hover': { bgcolor: editMode ? 'error.dark' : 'rgba(255,255,255,0.2)' }
                }}
              >
                {editMode ? 'Stop Designing' : 'Design Mode'}
              </Button>
              {navStack.length > 1 && (
                <Fab size="small" onClick={() => setNavStack(prev => prev.slice(0, -1))} color="secondary">
                  <ArrowBackIcon />
                </Fab>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        {/* --- CANVAS --- */}
        <Box 
          sx={{ height: '100%', width: '100%', position: 'relative', cursor: editMode ? 'crosshair' : 'default' }} 
          onClick={handleCanvasClick}
        >
          <AnimatePresence mode='wait'>
            <AnimatedDiv
              key={currentLevelId}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1, filter: revealLevel > 0 ? 'blur(0px)' : 'blur(40px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ width: '100%', height: '100%', backgroundImage: `url(${currentLevel?.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />
              
              {revealLevel > 1 && currentLevel?.items.map(item => (
                <Marker 
                  key={item.id} 
                  item={item} 
                  isEditMode={editMode} 
                  onDelete={handleDeleteItem}
                  onMove={handleMoveMarker}
                  onClick={(it) => {
                    if (it.type === 'gateway') {
                      if (palaces.some((palace) => palace.id === it.targetId)) {
                        setNavStack((prev) => [...prev, it.targetId]);
                      } else {
                        setStorageIssue('This gateway points to an environment that no longer exists. Delete or repair the gateway.');
                      }
                    } else {
                      setEditingItem(it);
                      setEditorOpen(true);
                    }
                  }} 
                />
              ))}
            </AnimatedDiv>
          </AnimatePresence>
        </Box>

        {/* --- DIALOGS --- */}
        
        {/* 1. Context Menu */}
        <Menu
          open={contextMenu !== null}
          onClose={() => setContextMenu(null)}
          anchorReference="anchorPosition"
          anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
          PaperProps={{ sx: { bgcolor: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' } }}
        >
          <MenuItem onClick={() => initiateCreate('note')}>
            <ListItemIcon><NoteIcon color="secondary" fontSize="small" /></ListItemIcon>
            <ListItemText primary="Place Memory" />
          </MenuItem>
          <MenuItem onClick={() => initiateCreate('gateway')}>
            <ListItemIcon><GatewayIcon color="primary" fontSize="small" /></ListItemIcon>
            <ListItemText primary="Open Gateway" />
          </MenuItem>
        </Menu>

        {/* 2. Note Editor with Color Harmony */}
        <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullWidth maxWidth="sm" TransitionComponent={GrowTransition} PaperProps={{ sx: { borderRadius: 4, bgcolor: '#1a1f26', width: '100%', maxWidth: 560, mx: 1, border: '1px solid rgba(255,255,255,0.1)' } }}>
          {editingItem && (
            <NoteEditorForm
              key={editingItem.id}
              initialItem={editingItem} 
              onSave={handleSaveNote} 
              onDelete={handleDeleteItem}
              onCancel={() => setEditorOpen(false)} 
            />
          )}
        </Dialog>

        {/* 3. Gateway Creator */}
        <Dialog open={gatewayDialogOpen} onClose={() => setGatewayDialogOpen(false)} fullWidth maxWidth="sm">
          <GatewaySetupForm 
            palaces={palaces} 
            currentId={currentLevelId} 
            onSubmit={handleCreateGateway} 
            onCancel={() => setGatewayDialogOpen(false)} 
          />
        </Dialog>

        {/* 4. Environment Settings */}
        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
          {currentLevel && (
            <EnvironmentSettingsForm 
              currentName={currentLevel.name} 
              currentUrl={currentLevel.imageUrl} 
              onSave={handleUpdateEnvironment} 
              onCancel={() => setSettingsOpen(false)} 
            />
          )}
        </Dialog>

        <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} fullWidth maxWidth="sm">
          <Box sx={{ p: 3, bgcolor: '#1a1f26', color: 'white' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Import a LociCanvas backup</Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>Paste a previously exported JSON backup. Import replaces the current local collection after confirmation.</Typography>
            <TextField fullWidth multiline minRows={8} maxRows={16} label="Backup JSON" value={transferText} onChange={event => setTransferText(event.target.value)} />
            {transferError && <Alert severity="error" sx={{ mt: 2 }}>{transferError}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button variant="contained" disabled={!transferText.trim()} onClick={handleImport}>Validate and Import</Button>
            </Box>
          </Box>
        </Dialog>

        <Dialog open={newEnvironmentOpen} onClose={() => setNewEnvironmentOpen(false)} fullWidth maxWidth="sm">
          <EnvironmentSettingsForm
            mode="create"
            currentName=""
            currentUrl=""
            onSave={handleCreateNewEnvironment}
            onCancel={() => setNewEnvironmentOpen(false)}
          />
        </Dialog>

        {/* 5. Sidebar */}
        <Drawer anchor="left" open={sidebarOpen} onClose={() => setSidebarOpen(false)} PaperProps={{ sx: { width: 320, bgcolor: '#0f1217' } }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontFamily: 'serif', fontStyle: 'italic', mb: 2 }}>Palace Collection</Typography>
            <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            <List>
              {palaces.map(p => (
                <ListItem key={p.id} disablePadding>
                  <ListItemButton 
                    selected={navStack.includes(p.id)}
                    onClick={() => { setNavStack([p.id]); setSidebarOpen(false); }}
                    sx={{ borderRadius: 2, mb: 1 }}
                  >
                    <ListItemIcon><BookIcon color={navStack.includes(p.id) ? 'primary' : 'inherit'} /></ListItemIcon>
                    <ListItemText primary={p.name} secondary={`${p.items.length} memories`} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <Button fullWidth startIcon={<AddIcon />} variant="outlined" sx={{ mt: 2 }} onClick={() => { setSidebarOpen(false); setNewEnvironmentOpen(true); }}>
              New Environment
            </Button>
          </Box>
        </Drawer>

        <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} PaperProps={{ sx: { bgcolor: '#1a1f26', color: 'white', maxWidth: 520, m: 2 } }}>
          <Box sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>LociCanvas Guide</Typography>
            <Typography sx={{ mb: 1 }}>Build a memory palace by placing ideas at meaningful locations in a visual environment.</Typography>
            <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 700 }}>Explore</Typography>
            <Typography variant="body2">Select a memory marker to read or edit its note. Select a gateway marker to travel to its linked environment. Use the collection button to open any palace.</Typography>
            <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 700 }}>Design</Typography>
            <Typography variant="body2">Turn on Design Mode, then click an empty area to place a memory or gateway. Drag existing markers to reposition them while Design Mode is active.</Typography>
            <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 700 }}>Organize</Typography>
            <Typography variant="body2">Use the settings control to rename the current environment or change its background. Use Palace Collection to create another environment.</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" onClick={() => setHelpOpen(false)}>Got it</Button>
            </Box>
          </Box>
        </Dialog>

        {storageIssue && (
          <Snackbar open anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
            <Alert severity={/exported|imported|restored/.test(storageIssue) ? 'success' : 'warning'} onClose={() => setStorageIssue('')} sx={{ maxWidth: 600 }}
              action={storageIssue.includes('recovery copy was preserved') ? <Button color="inherit" size="small" onClick={handleRestoreRecovery}>Try recovery</Button> : undefined}>
              {storageIssue}
            </Alert>
          </Snackbar>
        )}

        {/* Help Button */}
        <Box sx={{ position: 'absolute', bottom: 30, right: 30 }}>
          <Tooltip title="Guide">
            <Fab color="primary" onClick={() => setHelpOpen(true)}><LightbulbIcon /></Fab>
          </Tooltip>
        </Box>

        <Snackbar open={editMode} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="info" sx={{ width: '100%', bgcolor: 'rgba(33, 150, 243, 0.9)' }}>
            Design Mode: Click anywhere to add Memories or Gateways.
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

// --- MODULES ---

function NoteEditorForm({ initialItem, onSave, onDelete, onCancel }) {
  const [formData, setFormData] = useState(initialItem);
  const accentColor = formData.color || DEFAULT_THEME_COLOR;

  return (
    <Box sx={{ p: 4, borderTop: `6px solid ${accentColor}` }}>
      <Typography variant="h6" sx={{ mb: 3, color: accentColor }}>
        {formData.title ? 'Edit Memory' : 'New Memory'}
      </Typography>
      
      <TextField 
        fullWidth autoFocus label="Title" variant="filled" sx={{ mb: 3 }}
        value={formData.title}
        inputProps={{ maxLength: 120 }}
        onChange={e => setFormData({...formData, title: e.target.value})}
        error={!formData.title.trim()}
        helperText={!formData.title.trim() ? 'A title is required.' : ' '}
      />
      
      <TextField 
        fullWidth multiline rows={6} label="Content" variant="filled" 
        value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
        sx={{ bgcolor: alpha(accentColor, 0.05) }}
      />
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>Color Harmony</Typography>
        <Stack direction="row" spacing={1}>
          {ACCENT_COLORS.map(c => (
            <Tooltip key={c.hex} title={c.name}>
              <Box 
                onClick={() => setFormData({ ...formData, color: c.hex })}
                sx={{ 
                  width: 24, height: 24, borderRadius: '50%', bgcolor: c.hex, cursor: 'pointer',
                  border: formData.color === c.hex ? '2px solid white' : 'none',
                  boxShadow: formData.color === c.hex ? '0 0 10px white' : 'none'
                }} 
              />
            </Tooltip>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton onClick={() => onDelete(formData.id)} color="error" title="Delete Memory">
          <DeleteIcon />
        </IconButton>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button onClick={onCancel} color="inherit">Cancel</Button>
          <Button disabled={!formData.title.trim()} variant="contained" onClick={() => onSave({ ...formData, title: formData.title.trim() })} sx={{ bgcolor: accentColor, '&:hover': { bgcolor: accentColor } }}>
            Save
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function GatewaySetupForm({ palaces, currentId, onSubmit, onCancel }) {
  const [mode, setMode] = useState('existing'); 
  const [targetId, setTargetId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Circular reference protection
  const availablePalaces = palaces.filter(p => p.id !== currentId);

  const handleSubmit = () => {
    if (mode === 'existing' && targetId) onSubmit(targetId, false);
    else if (mode === 'new' && newName) onSubmit(null, true, newName, newUrl);
  };

  return (
    <Box sx={{ p: 4, width: 400 }}>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <GatewayIcon color="primary" /> Configure Gateway
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button variant={mode === 'existing' ? 'contained' : 'outlined'} onClick={() => setMode('existing')} size="small" fullWidth>Link Existing</Button>
        <Button variant={mode === 'new' ? 'contained' : 'outlined'} onClick={() => setMode('new')} size="small" fullWidth>Create New</Button>
      </Box>

      {mode === 'existing' ? (
        <FormControl fullWidth>
          <InputLabel>Destination</InputLabel>
          <Select value={targetId} label="Destination" onChange={(e) => setTargetId(e.target.value)}>
            {availablePalaces.length === 0 && <MenuItem disabled>No other environments</MenuItem>}
            {availablePalaces.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
      ) : (
        <>
          <TextField fullWidth label="Environment Name" value={newName} onChange={e => setNewName(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Image URL (Optional)" value={newUrl} onChange={e => setNewUrl(e.target.value)} error={!isValidHttpsUrl(newUrl, true)} helperText={!isValidHttpsUrl(newUrl, true) ? 'Use a valid HTTPS URL.' : 'Leave empty for the default background'} />
        </>
      )}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={mode === 'existing' ? !targetId || !availablePalaces.some(p => p.id === targetId) : !newName.trim() || !isValidHttpsUrl(newUrl, true)}>Create Link</Button>
      </Box>
    </Box>
  );
}

function EnvironmentSettingsForm({ currentName, currentUrl, onSave, onCancel, mode = 'edit' }) {
  const [name, setName] = useState(currentName);
  const [url, setUrl] = useState(currentUrl);

  return (
    <Box sx={{ p: 4, width: 400 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>{mode === 'create' ? 'New Environment' : 'Environment Settings'}</Typography>
      <TextField
        fullWidth
        label="Environment Name"
        value={name}
        onChange={e => setName(e.target.value)}
        inputProps={{ maxLength: 80 }}
        sx={{ mb: 3 }}
        required
      />
      <TextField fullWidth label="Background Image URL" value={url} onChange={e => setUrl(e.target.value)} error={!isValidHttpsUrl(url, true)} helperText={!isValidHttpsUrl(url, true) ? 'Use a valid HTTPS URL or leave empty.' : 'Use an HTTPS image URL or leave empty for no background.'} sx={{ mb: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" disabled={!name.trim() || !isValidHttpsUrl(url, true)} onClick={() => onSave(name, url)}>
          {mode === 'create' ? 'Create Environment' : 'Update Environment'}
        </Button>
      </Box>
    </Box>
  );
}

const GrowTransition = React.forwardRef(function Transition(props, ref) {
  return <Fade ref={ref} {...props} />;
});