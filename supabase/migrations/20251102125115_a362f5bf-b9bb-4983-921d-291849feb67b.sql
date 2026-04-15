-- Create function to automatically enroll profiles in email sequences when stage changes
CREATE OR REPLACE FUNCTION public.auto_enroll_in_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence_id uuid;
  v_sequence_name text;
  v_step record;
  v_profile_type text;
  v_trigger_stage text;
BEGIN
  -- Determine profile type and stage based on which table triggered this
  IF TG_TABLE_NAME = 'buyer_profiles' THEN
    v_profile_type := 'buyer';
    v_trigger_stage := NEW.stage::text;
  ELSE
    v_profile_type := 'seller';
    v_trigger_stage := NEW.stage::text;
  END IF;

  -- Check if stage actually changed
  IF OLD.stage = NEW.stage THEN
    RETURN NEW;
  END IF;

  -- Check if already enrolled in an active sequence
  IF v_profile_type = 'buyer' THEN
    IF EXISTS (
      SELECT 1 FROM profile_email_queue 
      WHERE buyer_profile_id = NEW.id 
      AND status IN ('pending', 'sent')
    ) THEN
      RETURN NEW;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM profile_email_queue 
      WHERE seller_profile_id = NEW.id 
      AND status IN ('pending', 'sent')
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Find active sequence matching profile type and trigger stage
  SELECT id, name INTO v_sequence_id, v_sequence_name
  FROM email_sequences
  WHERE profile_type = v_profile_type
    AND trigger_stage = v_trigger_stage
    AND is_active = true
  LIMIT 1;

  -- If matching sequence found, enroll the profile
  IF v_sequence_id IS NOT NULL THEN
    -- Create queue entries for all steps in the sequence
    FOR v_step IN
      SELECT step_number, template_key, delay_hours
      FROM email_sequence_steps
      WHERE sequence_id = v_sequence_id
      ORDER BY step_number
    LOOP
      IF v_profile_type = 'buyer' THEN
        INSERT INTO profile_email_queue (
          buyer_profile_id,
          sequence_id,
          step_number,
          template_key,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          v_sequence_id,
          v_step.step_number,
          v_step.template_key,
          NOW() + (v_step.delay_hours || ' hours')::INTERVAL,
          'pending'
        );
      ELSE
        INSERT INTO profile_email_queue (
          seller_profile_id,
          sequence_id,
          step_number,
          template_key,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          v_sequence_id,
          v_step.step_number,
          v_step.template_key,
          NOW() + (v_step.delay_hours || ' hours')::INTERVAL,
          'pending'
        );
      END IF;
    END LOOP;

    -- Log the enrollment as a CRM activity
    INSERT INTO crm_activities (
      buyer_profile_id,
      seller_profile_id,
      activity_type,
      title,
      description,
      metadata
    ) VALUES (
      CASE WHEN v_profile_type = 'buyer' THEN NEW.id ELSE NULL END,
      CASE WHEN v_profile_type = 'seller' THEN NEW.id ELSE NULL END,
      'email_sent',
      'Auto-enrolled in Email Sequence',
      'Automatically enrolled in "' || v_sequence_name || '" sequence due to stage change to ' || v_trigger_stage,
      jsonb_build_object(
        'sequence_id', v_sequence_id,
        'sequence_name', v_sequence_name,
        'trigger_stage', v_trigger_stage,
        'auto_enrolled', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for buyer profiles
DROP TRIGGER IF EXISTS trigger_auto_enroll_buyer_sequence ON buyer_profiles;
CREATE TRIGGER trigger_auto_enroll_buyer_sequence
  AFTER UPDATE OF stage ON buyer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_in_sequence();

-- Create trigger for seller profiles
DROP TRIGGER IF EXISTS trigger_auto_enroll_seller_sequence ON seller_profiles;
CREATE TRIGGER trigger_auto_enroll_seller_sequence
  AFTER UPDATE OF stage ON seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_in_sequence();