/**
 * Configuration Helper Functions
 *
 * Utility functions for accessing configuration throughout the application.
 * This provides a centralized way to get config values with fallbacks.
 */

import { campConfig } from '../../../../config/camp.config';
import { brandConfig } from '../../../../config/brand.config';
import { contentConfig } from '../../../../config/content.config';
import type { CampConfig, BrandConfig, ContentConfig } from '../../../../config/types';

/**
 * Get camp configuration
 */
export function getCampConfig(): CampConfig {
  return campConfig;
}

/**
 * Get brand configuration
 */
export function getBrandConfig(): BrandConfig {
  return brandConfig;
}

/**
 * Get content configuration
 */
export function getContentConfig(): ContentConfig {
  return contentConfig;
}

/**
 * Get a specific camp config value by path
 * @example getConfigValue('camp', 'name') => the camp name
 */
export function getConfigValue(
  section: 'camp' | 'brand' | 'content',
  path: string
): any {
  const config = {
    camp: campConfig,
    brand: brandConfig,
    content: contentConfig,
  }[section];

  const keys = path.split('.');
  let value: any = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof CampConfig['features']): boolean {
  return campConfig.features[feature] ?? false;
}

/**
 * Get all configurations as a single object
 */
export function getAllConfigs() {
  return {
    camp: campConfig,
    brand: brandConfig,
    content: contentConfig,
  };
}
