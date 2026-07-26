import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { loadAssetManifest, preloadTextures } from '../../../../src/ui/renderer/assetPreloader';
import * as TextureCache from '../../../../src/ui/renderer/TextureCache';

describe('assetPreloader', () => {
  describe('loadAssetManifest', () => {
    it('возвращает массив URL из манифеста', async () => {
      const urls = ['/assets/a.png', '/assets/b.png'];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(urls),
      } as unknown as Response);

      const result = await loadAssetManifest();

      expect(result).toEqual(urls);
      expect(global.fetch).toHaveBeenCalledWith('/assets/manifest.json');
    });

    it('бросает ошибку при неудачном ответе сервера', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);

      await expect(loadAssetManifest()).rejects.toThrow('Не удалось загрузить манифест ассетов');
    });

    it('бросает ошибку, если манифест не массив', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ notAnArray: true }),
      } as unknown as Response);

      await expect(loadAssetManifest()).rejects.toThrow('Манифест ассетов должен быть массивом строк URL');
    });
  });

  describe('preloadTextures', () => {
    it('загружает все URL через TextureCache.getTexture', async () => {
      const getTextureMock = vi.spyOn(TextureCache, 'getTexture').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof TextureCache.getTexture>>);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const urls = ['/assets/a.png', '/assets/b.png'];
      await preloadTextures(urls);

      expect(getTextureMock).toHaveBeenCalledTimes(2);
      expect(getTextureMock).toHaveBeenCalledWith('/assets/a.png');
      expect(getTextureMock).toHaveBeenCalledWith('/assets/b.png');
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      getTextureMock.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('логирует warning при ошибке загрузки отдельного ассета, но не падает', async () => {
      const getTextureMock = vi.spyOn(TextureCache, 'getTexture')
        .mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof TextureCache.getTexture>>)
        .mockRejectedValueOnce(new Error('404'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const urls = ['/assets/a.png', '/assets/missing.png'];
      await preloadTextures(urls);

      expect(getTextureMock).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('/assets/missing.png'),
        expect.any(Error),
      );
      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('Предзагружено 1 из 2 ассетов'),
      );

      getTextureMock.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
