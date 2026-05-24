/**
 * Корневой компонент UI.
 *
 * Ответственность:
 * - Управление отображением экранов на основе SessionMode из GameSession.
 * - Создание и хранение единственного экземпляра GameSession.
 * - Передача команд от UI-экранов в GameSession.
 *
 * Правила:
 * - Не содержит игровой логики.
 * - Не импортирует Simulation.
 */

import {useState, useCallback, useRef, useEffect} from 'react';
import {GameSession, type SessionMode} from '@presentation/gameSession';
import type {CharacterConfig, PlayerStatsSnapshot} from '@presentation/gameSession';
import {MainMenuScreen} from './screens/MainMenuScreen';
import {CharacterCreationScreen} from './screens/CharacterCreationScreen';
import {GameScreen} from './screens/GameScreen';
import {EndingScreen} from './screens/EndingScreen';

export default function App() {
  const sessionRef = useRef<GameSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new GameSession();
  }
  const session = sessionRef.current;

  const [mode, setMode] = useState<SessionMode>(session.getMode());

  useEffect(() => {
    // Выставляем в глобальную область для отладки в консоли
    const w = window as unknown as Record<string, unknown>;
    const prev = w.session;
    w.session = session;
    return () => {
      // При HMR / размонтировании восстанавливаем предыдущее значение
      w.session = prev;
    };
  }, [session]);

  const handleNewGame = useCallback(() => {
    session.enterCharacterCreation();
    setMode(session.getMode());
  }, [session]);

  const handleStartGame = useCallback(
    (config: CharacterConfig, seed: number) => {
      session.startNewGame(config, seed);
      setMode(session.getMode());
    },
    [session],
  );

  const handleReturnToMenu = useCallback(() => {
    session.returnToMenu();
    setMode(session.getMode());
  }, [session]);

  const handleModeChange = useCallback((newMode: SessionMode) => {
    setMode(newMode);
  }, []);

  switch (mode) {
    case 'mainMenu':
      return <MainMenuScreen onNewGame={handleNewGame} />;

    case 'characterCreation':
      return <CharacterCreationScreen onStartGame={handleStartGame} />;

    case 'playing':
      return <GameScreen session={session} onModeChange={handleModeChange} />;

    case 'gameOver': {
      const defeatRenderInput = session.getViewModel().renderInput;
      const defeatPortraitId = defeatRenderInput?.portraitId;
      const defeatStats = defeatRenderInput?.playerStats;
      const defeatEquipment = defeatRenderInput?.equipment;
      return (
        <EndingScreen
          result="defeat"
          onNewRun={handleNewGame}
          onReturnToMenu={handleReturnToMenu}
          portraitSrc={
            defeatPortraitId
              ? `/assets/portraits/${defeatPortraitId}-ready.png`
              : undefined
          }
          playerStats={defeatStats}
          equipment={defeatEquipment}
        />
      );
    }

    case 'victory': {
      const victoryRenderInput = session.getViewModel().renderInput;
      const victoryPortraitId = victoryRenderInput?.portraitId;
      const victoryStats = victoryRenderInput?.playerStats;
      const victoryEquipment = victoryRenderInput?.equipment;
      return (
        <EndingScreen
          result="victory"
          onNewRun={handleNewGame}
          onReturnToMenu={handleReturnToMenu}
          portraitSrc={
            victoryPortraitId
              ? `/assets/portraits/${victoryPortraitId}-ready.png`
              : undefined
          }
          playerStats={victoryStats}
          equipment={victoryEquipment}
        />
      );
    }

    default:
      return <div>Неизвестный режим: {mode}</div>;
  }
}
