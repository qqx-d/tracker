import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

// --- Toast ---
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="toast">{message}</div>;
}

// --- Welcome screen (registration) ---
function WelcomeScreen({ onRegister }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      const user = await api.register(name.trim());
      onRegister(user);
    } catch {
      alert('Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-title">Daily Check-in</div>
      <div className="welcome-subtitle">Отмечайся каждый день вместе с друзьями</div>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320 }}>
        <div className="input-group">
          <label>Как тебя зовут?</label>
          <input
            className="input"
            placeholder="Введи имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>
        <button className="btn btn-primary" disabled={!name.trim() || loading}>
          {loading ? 'Загрузка...' : 'Начать'}
        </button>
      </form>
    </div>
  );
}

// --- Add modal (create or join) ---
function AddModal({ onClose, onCreateLobby, onJoinLobby }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      await onCreateLobby(name.trim());
      onClose();
    } catch {
      alert('Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    try {
      await onJoinLobby(code.trim().toUpperCase());
      onClose();
    } catch {
      alert('Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        {mode === null && (
          <>
            <div className="modal-title">Добавить</div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setMode('create')}>
                Создать лобби
              </button>
              <button className="btn btn-secondary" onClick={() => setMode('join')}>
                Войти по коду
              </button>
              <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 4 }}>
                Отмена
              </button>
            </div>
          </>
        )}
        {mode === 'create' && (
          <form onSubmit={handleCreate}>
            <div className="modal-title">Новое лобби</div>
            <div className="input-group">
              <label>Название</label>
              <input
                className="input"
                placeholder="Например: Утренняя зарядка"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" disabled={!name.trim() || loading}>
                {loading ? 'Создание...' : 'Создать'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>
                Назад
              </button>
            </div>
          </form>
        )}
        {mode === 'join' && (
          <form onSubmit={handleJoin}>
            <div className="modal-title">Войти по коду</div>
            <div className="input-group">
              <label>Код лобби</label>
              <input
                className="input"
                placeholder="Введи код"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoFocus
                style={{ letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace', fontSize: 24 }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" disabled={!code.trim() || loading}>
                {loading ? 'Подключение...' : 'Войти'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>
                Назад
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- Home page: list of lobbies ---
function HomePage({ lobbies, onSelectLobby, onLeaveLobby, loading }) {
  const pressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

  const startPress = (lobby) => {
    didLongPressRef.current = false;
    pressTimerRef.current = setTimeout(async () => {
      didLongPressRef.current = true;
      const confirmed = window.confirm(`Выйти из лобби "${lobby.name}"?`);
      if (confirmed) {
        await onLeaveLobby(lobby);
      }
    }, 650);
  };

  const clearPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  if (loading) {
    return (
      <div className="page-content">
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  if (lobbies.length === 0) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">Пока пусто</div>
          <div className="empty-state-text">
            Нажми + чтобы создать лобби или присоединиться к друзьям по коду
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Мои лобби</h1>
        <p>Ежедневные чек-ины. Зажми карточку, чтобы выйти</p>
      </div>
      {lobbies.map((lobby) => (
        <div
          className="card"
          key={lobby.id}
          onClick={() => {
            if (didLongPressRef.current) {
              didLongPressRef.current = false;
              return;
            }
            onSelectLobby(lobby);
          }}
          onTouchStart={() => startPress(lobby)}
          onTouchEnd={clearPress}
          onTouchCancel={clearPress}
          onMouseDown={() => startPress(lobby)}
          onMouseUp={clearPress}
          onMouseLeave={clearPress}
        >
          <div className="card-header">
            <span className="card-title">{lobby.name}</span>
            <span className="card-code">{lobby.code}</span>
          </div>
          <div className="card-subtitle">
            {lobby.members?.length || 0} участник(ов)
          </div>
          <div className="members-row">
            {(lobby.members || []).slice(0, 8).map((m, i) => (
              <div className="member-avatar" key={i}>
                <span className="member-avatar-letter">{(m.username || '?')[0].toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Lobby detail page ---
function LobbyPage({ lobby, user, onBack, showToast, refreshLobby, onDeleteLobby }) {
  const [stats, setStats] = useState(null);
  const [todayCheckins, setTodayCheckins] = useState([]);
  const [checking, setChecking] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const didCheckin = todayCheckins.some((c) => c.userId === user.id);
  const isOwner = lobby.ownerId === user.id;

  const loadData = useCallback(async () => {
    try {
      const [statsData, checkinsData] = await Promise.all([
        api.getStats(lobby.id),
        api.getCheckins(lobby.id, today),
      ]);
      setStats(statsData);
      setTodayCheckins(checkinsData.checkins || []);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  }, [lobby.id, today]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCheckin = async () => {
    if (checking || didCheckin) return;
    setChecking(true);
    try {
      await api.checkin(lobby.id, user.id);
      showToast('Чек-ин выполнен');
      loadData();
      refreshLobby();
    } catch {
      showToast('Ошибка чек-ина');
    } finally {
      setChecking(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(lobby.code);
    showToast('Код скопирован!');
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    const confirmed = window.confirm('Удалить это лобби? Это действие нельзя отменить.');
    if (!confirmed) return;
    try {
      await onDeleteLobby(lobby.id);
    } catch {
      showToast('Не удалось удалить лобби');
    }
  };

  return (
    <div className="page-content">
      <button className="back-btn" onClick={onBack}>Назад</button>

      <div className="lobby-header">
        <div className="lobby-header-title-row">
          <h2>{lobby.name}</h2>
          {isOwner && (
            <button className="lobby-delete-btn" onClick={handleDelete}>
              Удалить
            </button>
          )}
        </div>
        <div className="code" onClick={copyCode} style={{ cursor: 'pointer' }}>
          {lobby.code}
        </div>
      </div>

      {/* Today check-in */}
      <button
        className={`checkin-btn ${didCheckin ? 'done' : 'ready'}`}
        onClick={handleCheckin}
        disabled={didCheckin || checking}
      >
        {didCheckin ? 'Ты отметился сегодня' : checking ? 'Отмечаемся...' : 'Отметиться'}
      </button>

      {/* Today's status */}
      <div className="today-section" style={{ marginTop: 24 }}>
        <h3>Сегодня ({today})</h3>
        <div className="today-members">
          {(lobby.members || []).map((m) => {
            const checked = todayCheckins.some((c) => c.userId === m.id);
            return (
              <div className="today-member" key={m.id}>
                <div className="member-avatar">
                  <span className="member-avatar-letter">{(m.username || '?')[0].toUpperCase()}</span>
                </div>
                <div className="today-member-name">{m.username}</div>
                <div className={`today-member-status ${checked ? 'checked' : 'waiting'}`}>
                  {checked ? 'Done' : '...'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <div className="loading"><div className="spinner" /></div>
      ) : stats && stats.members ? (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Статистика (последние 14 дней)
          </h3>
          <div className="stats-table">
            {stats.members.map((member) => (
              <div className="stats-row" key={member.id}>
                <div className="stats-name">{member.username}</div>
                <div className="stats-streak">
                  {member.streak || 0} streak
                </div>
                <div className="stats-marks">
                  {(member.days || []).slice(-7).map((day, i) => (
                    <div
                      key={i}
                      className={`stats-mark ${day.checked ? 'check' : 'cross'}`}
                      title={day.date}
                    >
                      {day.checked ? '✓' : '✕'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Settings page ---
function SettingsPage({ user, onLogout, installPrompt, onInstall }) {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true);
    }
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      onInstall();
    } else {
      // iOS Safari doesn't support beforeinstallprompt
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const msg = isIOS
        ? 'Нажми кнопку "Поделиться" внизу экрана, затем "На экран Домой"'
        : 'Нажми меню браузера (⋮) → "Установить приложение"';
      alert(msg);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Очистить кэш и перезагрузить?')) return;
    
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        reg.unregister();
      }
    }
    
    // Clear all caches
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    
    // Clear IndexedDB
    if (indexedDB) {
      const dbs = await indexedDB.databases?.() || [];
      for (const db of dbs) {
        indexedDB.deleteDatabase(db.name);
      }
    }
    
    location.reload();
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Настройки</h1>
      </div>

      <div className="card">
        <div className="settings-item">
          <span className="settings-label">Имя</span>
          <span className="settings-value">{user.username}</span>
        </div>
        <div className="settings-item">
          <span className="settings-label">ID</span>
          <span className="settings-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {user.id}
          </span>
        </div>
      </div>

      {!installed && (
        <button className="btn btn-primary" onClick={handleInstallClick} style={{ marginTop: 16 }}>
          Установить
        </button>
      )}

      <button className="btn" onClick={handleClearCache} style={{ marginTop: 12, background: '#555', border: '1px solid #666' }}>
        Очистить кэш
      </button>

      <button className="btn btn-danger" onClick={onLogout} style={{ marginTop: 12 }}>
        Выйти
      </button>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('checkin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState('home'); // home | settings
  const [lobbies, setLobbies] = useState([]);
  const [selectedLobby, setSelectedLobby] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadingLobbies, setLoadingLobbies] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    // Pick up the prompt captured globally before React mounted
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
      window.__pwaInstallPrompt = null;
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      window.__pwaInstallPrompt = null;
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstallPrompt(null);
    window.addEventListener('appinstalled', installedHandler);

    // Chrome may fire beforeinstallprompt with a delay after SW activates.
    // Poll the global variable in case it arrives after mount but before
    // the React event listener catches it.
    const poll = setInterval(() => {
      if (window.__pwaInstallPrompt) {
        setInstallPrompt(window.__pwaInstallPrompt);
        window.__pwaInstallPrompt = null;
        clearInterval(poll);
      }
    }, 1000);

    return () => {
      clearInterval(poll);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const showToast = useCallback((msg) => {
    setToast(msg);
  }, []);

  const loadLobbies = useCallback(async () => {
    if (!user) return;
    setLoadingLobbies(true);
    try {
      const data = await api.getUserLobbies(user.id);
      setLobbies(data.lobbies || []);
    } catch {
      // ignore
    } finally {
      setLoadingLobbies(false);
    }
  }, [user]);

  useEffect(() => {
    loadLobbies();
  }, [loadLobbies]);

  const handleRegister = (userData) => {
    setUser(userData);
    localStorage.setItem('checkin_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setLobbies([]);
    setSelectedLobby(null);
    localStorage.removeItem('checkin_user');
  };

  const handleCreateLobby = async (name) => {
    const lobby = await api.createLobby(name, user.id);
    showToast(`Лобби создано! Код: ${lobby.code}`);
    loadLobbies();
  };

  const handleJoinLobby = async (code) => {
    await api.joinLobby(code, user.id);
    showToast('Вы присоединились!');
    loadLobbies();
  };

  const handleSelectLobby = async (lobby) => {
    try {
      const full = await api.getLobby(lobby.id);
      setSelectedLobby(full);
    } catch {
      setSelectedLobby(lobby);
    }
  };

  const handleDeleteLobby = async (lobbyId) => {
    await api.deleteLobby(lobbyId, user.id);
    showToast('Группа удалена');
    setSelectedLobby(null);
    loadLobbies();
  };

  const handleLeaveLobby = async (lobby) => {
    try {
      await api.leaveLobby(lobby.id, user.id);
      showToast('Вы вышли из лобби');
      if (selectedLobby?.id === lobby.id) {
        setSelectedLobby(null);
      }
      loadLobbies();
    } catch {
      showToast('Не удалось выйти из лобби');
    }
  };

  if (!user) {
    return <WelcomeScreen onRegister={handleRegister} />;
  }

  return (
    <>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {selectedLobby ? (
        <LobbyPage
          lobby={selectedLobby}
          user={user}
          onBack={() => { setSelectedLobby(null); loadLobbies(); }}
          showToast={showToast}
          onDeleteLobby={handleDeleteLobby}
          refreshLobby={async () => {
            try {
              const full = await api.getLobby(selectedLobby.id);
              setSelectedLobby(full);
            } catch { /* ignore */ }
          }}
        />
      ) : tab === 'home' ? (
        <HomePage
          lobbies={lobbies}
          onSelectLobby={handleSelectLobby}
          onLeaveLobby={handleLeaveLobby}
          loading={loadingLobbies}
        />
      ) : (
        <SettingsPage user={user} onLogout={handleLogout} installPrompt={installPrompt} onInstall={handleInstall} />
      )}

      {/* Bottom navigation */}
      {!selectedLobby && (
        <nav className="bottom-nav">
          <button
            className={`nav-btn ${tab === 'home' ? 'active' : ''}`}
            onClick={() => setTab('home')}
          >
            <img src={`${import.meta.env.BASE_URL}icons/menu.png`} alt="menu" />
          </button>

          <button className="nav-btn-add" onClick={() => setShowAdd(true)}>
            <img src={`${import.meta.env.BASE_URL}icons/add.png`} alt="add" />
          </button>

          <button
            className={`nav-btn ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            <img src={`${import.meta.env.BASE_URL}icons/settings.png`} alt="settings" />
          </button>
        </nav>
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onCreateLobby={handleCreateLobby}
          onJoinLobby={handleJoinLobby}
        />
      )}
    </>
  );
}
