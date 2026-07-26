/**
 * Общий мок PixiJS для unit-тестов UI-анимаций.
 *
 * Предоставляет минимальную реализацию Container, Graphics, Sprite,
 * Texture, Text и Ticker, достаточную для проверки примитивов и renderer'а
 * без реального canvas.
 */

export type MockPixiModule = ReturnType<typeof createMockPixiModule>;
export type MockContainer = InstanceType<MockPixiModule['Container']>;
export type MockGraphics = InstanceType<MockPixiModule['Graphics']>;
export type MockTicker = InstanceType<MockPixiModule['Ticker']>;

export function createMockPixiModule() {
  class MockTexture {
    static EMPTY = new MockTexture();
    static from() {
      return new MockTexture();
    }
  }

  class MockSprite {
    x = 0;
    y = 0;
    alpha = 1;
    visible = true;
    width = 0;
    height = 0;
    texture = MockTexture.EMPTY;
    parent?: MockContainer;
    anchor = {
      x: 0,
      y: 0,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    scale = {
      x: 1,
      y: 1,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    destroy() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
    }
    static from() {
      return new MockSprite();
    }
  }

  class MockContainer {
    children: any[] = [];
    sortableChildren = false;
    x = 0;
    y = 0;
    scale = {
      x: 1,
      y: 1,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    addChild(c: any) {
      this.children.push(c);
      c.parent = this;
      return c;
    }
    removeChild(c: any) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    }
    removeChildren() {
      this.children = [];
    }
    destroy() {}
  }

  class MockGraphics {
    x = 0;
    y = 0;
    alpha = 1;
    visible = true;
    scale = {
      x: 1,
      y: 1,
      set(x: number, y?: number) {
        (this as any).x = x;
        (this as any).y = y ?? x;
      },
    };
    parent?: MockContainer;
    private _commands: Array<{ method: string; args: any[] }> = [];

    clear() {
      this._commands = [];
      return this;
    }
    moveTo(x: number, y: number) {
      this._commands.push({ method: 'moveTo', args: [x, y] });
      return this;
    }
    lineTo(x: number, y: number) {
      this._commands.push({ method: 'lineTo', args: [x, y] });
      return this;
    }
    arc(...args: any[]) {
      this._commands.push({ method: 'arc', args });
      return this;
    }
    circle(x: number, y: number, radius: number) {
      this._commands.push({ method: 'circle', args: [x, y, radius] });
      return this;
    }
    rect(...args: any[]) {
      this._commands.push({ method: 'rect', args });
      return this;
    }
    fill(...args: any[]) {
      this._commands.push({ method: 'fill', args });
      return this;
    }
    stroke(...args: any[]) {
      this._commands.push({ method: 'stroke', args });
      return this;
    }
    destroy() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
    }
    get commands() {
      return this._commands;
    }
  }

  class MockText {
    x = 0;
    y = 0;
    visible = true;
    anchor = { set() {} };
    style = {};
    parent?: MockContainer;
    destroy() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
    }
  }

  class MockTicker {
    callbacks: (() => void)[] = [];
    add(fn: () => void) {
      this.callbacks.push(fn);
    }
    remove(fn: () => void) {
      const i = this.callbacks.indexOf(fn);
      if (i >= 0) this.callbacks.splice(i, 1);
    }
  }

  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: MockTexture,
    Graphics: MockGraphics,
    Text: MockText,
    Ticker: MockTicker,
  };
}
