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

import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {CharacterConfig} from '@presentation/gameSession';
import {GameSession, type SessionMode} from '@presentation/gameSession';
import {useSettingsStore} from '@ui/store/settings';

import {MainMenuScreen} from './screens/MainMenuScreen';
import {CharacterCreationScreen} from './screens/CharacterCreationScreen';
import {GameScreen} from './screens/GameScreen';
import {EndingScreen} from './screens/EndingScreen';

export default function App() {
  const { t } = useTranslation('common');
  const sessionRef = useRef<GameSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new GameSession();
  }
  const session = sessionRef.current;

  const [mode, setMode] = useState<SessionMode>(session.getMode());
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    session.setLocale(locale);
  }, [session, locale]);

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

  const getEndingProps = useCallback(
    (result: 'defeat' | 'victory') => {
      const renderInput = session.getViewModel().renderInput;
      const templateId = renderInput?.state.player.templateId;
      return {
        result,
        onNewRun: handleNewGame,
        onReturnToMenu: handleReturnToMenu,
        portraitSrc: GameSession.getPlayerPortraitSrc(templateId ?? ''),
        playerStats: renderInput?.playerStats,
        equipment: renderInput?.equipment,
        runStats: renderInput?.runStats,
        floor: renderInput?.state.floor,
        turnRound: renderInput?.state.turn.round,
        defeatedBosses: session.getDefeatedBosses(),
      };
    },
    [session, handleNewGame, handleReturnToMenu],
  );

  switch (mode) {
    case 'mainMenu':
      return <MainMenuScreen onNewGame={handleNewGame} />;

    case 'characterCreation':
      return <CharacterCreationScreen onStartGame={handleStartGame} />;

    case 'playing':
      return <GameScreen session={session} onModeChange={handleModeChange} />;

    case 'gameOver':
      return <EndingScreen {...getEndingProps('defeat')} />;

    case 'victory':
      return <EndingScreen {...getEndingProps('victory')} />;

    default:
      return <div>{t('ui.unknownMode', { mode })}</div>;
  }
}
