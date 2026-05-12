/**
 * @file features/business-profile/services/business-profile.service.ts
 * All HTTP calls for the business profile feature.
 */

import { apiClient } from '@/lib/api-client';
import type {
  BusinessProfileResponseDto,
  BusinessProfileSummaryDto,
  UpdateBusinessProfileDto,
} from '../types/business-profile.types';

const BASE = '/business-profiles';

export async function fetchProfiles(): Promise<BusinessProfileSummaryDto[]> {
  return apiClient<BusinessProfileSummaryDto[]>(BASE);
}

export async function fetchProfile(id: string): Promise<BusinessProfileResponseDto> {
  return apiClient<BusinessProfileResponseDto>(`${BASE}/${id}`);
}

export async function updateProfile(
  id:  string,
  dto: UpdateBusinessProfileDto,
): Promise<BusinessProfileResponseDto> {
  return apiClient<BusinessProfileResponseDto>(`${BASE}/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(dto),
  });
}
