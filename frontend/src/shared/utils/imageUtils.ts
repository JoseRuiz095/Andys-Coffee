// frontend/src/shared/utils/imageUtils.ts

import { SUPABASE_URL } from '../constants/config';

/**
 * Constructs a full URL for an image stored in Supabase Storage.
 * This helper uses the Supabase URL from `../constants/config.ts`.
 *
 * @param imagePath The relative path of the image within the Supabase bucket (e.g., 'products/coffee.jpg').
 * @param bucketName The name of the Supabase storage bucket. Defaults to 'Img'.
 * @param accessType The type of access for the image ('public' or 'sign'). Defaults to 'public'.
 * @returns The full URL to the image, or an empty string if SUPABASE_URL is not defined.
 */
export function getSupabaseImageUrl(
  imagePath: string,
  bucketName: string = 'Img',
  accessType: 'public' | 'sign' = 'public'
): string {
  if (!SUPABASE_URL) {
    console.warn('SUPABASE_URL is not defined. Image URLs cannot be constructed.');
    return '';
  }

  // Ensure the base URL does not end with a slash and imagePath does not start with one,
  // then ensure the bucketName does not start or end with one.
  const baseUrl = SUPABASE_URL.endsWith('/') ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
  const cleanedImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  const cleanedBucketName = bucketName.replace(/^\/|\/$/g, '');


  // Supabase storage URL format:
  // [SUPABASE_URL]/storage/v1/object/[ACCESS_TYPE]/[BUCKET_NAME]/[IMAGE_PATH]
  return `${baseUrl}/storage/v1/object/${accessType}/${cleanedBucketName}/${cleanedImagePath}`;
}