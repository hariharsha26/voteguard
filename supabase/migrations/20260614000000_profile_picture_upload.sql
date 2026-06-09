-- Migration 20260614000000: Voter Profile Picture Upload Support

-- 1. Create storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-pictures', 
    'profile-pictures', 
    true, 
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow public read access to profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update/delete own profile picture" ON storage.objects;

-- 3. Create policies for the profile-pictures bucket
-- Anyone (voters, admins, guests) can view profile pictures
CREATE POLICY "Allow public read access to profile pictures"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profile-pictures');

-- Authenticated users can upload files only to a subfolder named after their own UID
CREATE POLICY "Allow authenticated users to upload own profile picture"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'profile-pictures' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can modify/delete files only in their own folder
CREATE POLICY "Allow authenticated users to update/delete own profile picture"
ON storage.objects FOR ALL TO authenticated
USING (
    bucket_id = 'profile-pictures' AND
    (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'profile-pictures' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Create voter profile photo database update RPCs
CREATE OR REPLACE FUNCTION public.update_voter_profile_photo(
    p_profile_photo_url TEXT
)
RETURNS jsonb AS $$
DECLARE
    v_roll_number TEXT;
    v_old_photo_url TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT roll_number, profile_photo_url INTO v_roll_number, v_old_photo_url
    FROM public.voters
    WHERE auth_user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    UPDATE public.voters
    SET profile_photo_url = p_profile_photo_url,
        updated_at = NOW()
    WHERE auth_user_id = auth.uid();

    -- Log audit event
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('PROFILE_PHOTO_UPDATED', v_roll_number, 'Voter updated profile photo.');

    RETURN jsonb_build_object(
        'success', true,
        'old_photo_url', v_old_photo_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.remove_voter_profile_photo()
RETURNS jsonb AS $$
DECLARE
    v_roll_number TEXT;
    v_old_photo_url TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT roll_number, profile_photo_url INTO v_roll_number, v_old_photo_url
    FROM public.voters
    WHERE auth_user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voter profile not found.';
    END IF;

    UPDATE public.voters
    SET profile_photo_url = NULL,
        updated_at = NOW()
    WHERE auth_user_id = auth.uid();

    -- Log audit event
    INSERT INTO public.audit_logs (event_type, actor, details)
    VALUES ('PROFILE_PHOTO_UPDATED', v_roll_number, 'Voter removed profile photo.');

    RETURN jsonb_build_object(
        'success', true,
        'old_photo_url', v_old_photo_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION public.update_voter_profile_photo(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_voter_profile_photo() TO authenticated;
