/**
 * @file src/app.controller.spec.ts
 * @description Unit tests for AppController.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('returns status "ok"', () => {
      const result = controller.getHealth();
      expect(result.status).toBe('ok');
    });

    it('returns a valid ISO timestamp', () => {
      const result = controller.getHealth();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('returns a non-negative uptime in seconds', () => {
      const result = controller.getHealth();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.uptime)).toBe(true);
    });
  });
});
