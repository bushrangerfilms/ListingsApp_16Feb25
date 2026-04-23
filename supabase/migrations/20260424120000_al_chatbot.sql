-- Al chatbot: in-app AI assistant tables
-- Lives in public schema so both Listings and Socials apps can read/write.

create table if not exists public.al_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app text not null check (app in ('listings','socials')),
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists al_conversations_user_recent_idx
  on public.al_conversations (user_id, last_message_at desc);

create index if not exists al_conversations_org_idx
  on public.al_conversations (organization_id);

create table if not exists public.al_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.al_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  route text,
  has_image boolean not null default false,
  model text,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  cost_usd numeric(10,6),
  latency_ms int,
  feedback text check (feedback in ('up','down')),
  feedback_comment text,
  created_at timestamptz not null default now()
);

create index if not exists al_messages_conversation_idx
  on public.al_messages (conversation_id, created_at);

create index if not exists al_messages_feedback_idx
  on public.al_messages (feedback, created_at desc) where feedback is not null;

-- One row per (org, month). Daily counter resets on date change.
create table if not exists public.al_usage_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month_start date not null,
  messages_this_month int not null default 0,
  messages_today int not null default 0,
  today date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (organization_id, month_start)
);

create index if not exists al_usage_counters_today_idx
  on public.al_usage_counters (today);

-- Atomic increment helper. Resets daily counter if the date rolled over.
create or replace function public.al_increment_usage(p_org_id uuid)
returns table (messages_this_month int, messages_today int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', now())::date;
  v_today date := current_date;
  v_month int;
  v_day int;
begin
  insert into public.al_usage_counters (organization_id, month_start, messages_this_month, messages_today, today)
  values (p_org_id, v_month_start, 1, 1, v_today)
  on conflict (organization_id, month_start) do update
    set messages_this_month = public.al_usage_counters.messages_this_month + 1,
        messages_today = case
          when public.al_usage_counters.today = v_today then public.al_usage_counters.messages_today + 1
          else 1
        end,
        today = v_today,
        updated_at = now()
  returning public.al_usage_counters.messages_this_month, public.al_usage_counters.messages_today
    into v_month, v_day;
  messages_this_month := v_month;
  messages_today := v_day;
  return next;
end;
$$;

grant execute on function public.al_increment_usage(uuid) to authenticated, service_role;

-- RLS: users see only their own conversations + messages; super_admin sees all.
alter table public.al_conversations enable row level security;
alter table public.al_messages enable row level security;
alter table public.al_usage_counters enable row level security;

create policy "users read own al conversations"
  on public.al_conversations for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'super_admin'
    )
  );

create policy "service role manages al conversations"
  on public.al_conversations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "users read own al messages"
  on public.al_messages for select
  using (
    exists (
      select 1 from public.al_conversations c
      where c.id = al_messages.conversation_id
        and (c.user_id = auth.uid()
             or exists (select 1 from public.user_roles ur
                        where ur.user_id = auth.uid() and ur.role = 'super_admin'))
    )
  );

create policy "users update own al message feedback"
  on public.al_messages for update
  using (
    exists (
      select 1 from public.al_conversations c
      where c.id = al_messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.al_conversations c
      where c.id = al_messages.conversation_id and c.user_id = auth.uid()
    )
  );

create policy "service role manages al messages"
  on public.al_messages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "org members read own usage counter"
  on public.al_usage_counters for select
  using (
    exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid() and uo.organization_id = al_usage_counters.organization_id
    )
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'super_admin'
    )
  );

create policy "service role manages al usage counters"
  on public.al_usage_counters for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
