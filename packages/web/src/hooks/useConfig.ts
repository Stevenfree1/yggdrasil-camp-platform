/**
 * useConfig Hook
 *
 * React hook for accessing configuration in components.
 * Provides easy access to camp, brand, and content configuration.
 */

import { useMemo } from 'react';
import {
  getCampConfig,
  getBrandConfig,
  getContentConfig,
  isFeatureEnabled,
  getAllConfigs,
} from '../lib/config';
import type { CampConfig, BrandConfig, ContentConfig } from '../../../../config/types';

interface UseConfigReturn {
  camp: CampConfig;
  brand: BrandConfig;
  content: ContentConfig;
  isFeatureEnabled: (feature: keyof CampConfig['features']) => boolean;
}

/**
 * Hook to access all configuration
 * @example
 * const { camp, brand, content } = useConfig();
 * console.log(camp.name); // e.g. "Camp Dust Devil"
 */
export function useConfig(): UseConfigReturn {
  const configs = useMemo(() => getAllConfigs(), []);

  return {
    camp: configs.camp,
    brand: configs.brand,
    content: configs.content,
    isFeatureEnabled,
  };
}

/**
 * Hook to access camp configuration only
 */
export function useCampConfig(): CampConfig {
  return useMemo(() => getCampConfig(), []);
}

/**
 * Hook to access brand configuration only
 */
export function useBrandConfig(): BrandConfig {
  return useMemo(() => getBrandConfig(), []);
}

/**
 * Hook to access content configuration only
 */
export function useContentConfig(): ContentConfig {
  return useMemo(() => getContentConfig(), []);
}
