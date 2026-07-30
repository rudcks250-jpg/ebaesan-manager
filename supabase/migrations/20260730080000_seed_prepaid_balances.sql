-- 제공받은 16명 고객의 현재 잔액만 오늘 날짜 선결제 1건으로 등록합니다.
-- 동일 이름 고객은 하나로 통합하며 기존 거래는 소프트 삭제해 복구 가능하게 보존합니다.
do $$
declare
  v_operator public.employees;
  v_seed record;
  v_customer_id uuid;
  v_duplicate record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
  v_balance bigint;
begin
  select * into v_operator
  from public.employees
  where name = '박경찬' and status = 'active'
  order by created_at
  limit 1;

  if v_operator.id is null then
    raise exception '초기 선결제 등록을 위한 박경찬 직원 계정을 찾을 수 없습니다.';
  end if;

  for v_seed in
    select * from (values
      ('오픈', '01040110500', 16000::bigint, null::text),
      ('박병문', '', 49000::bigint, null::text),
      ('갤러리', '01033960504', 314000::bigint, null::text),
      ('서든포스트', '', 11000::bigint, null::text),
      ('이승미', '01044040116', 202000::bigint, null::text),
      ('손지원', '', 29000::bigint, null::text),
      ('윤정준', '', 220000::bigint, '경찬 분당 할아버지 사위'),
      ('올케어 성형외과', '', 57000::bigint, null::text),
      ('김가희', '', 317000::bigint, null::text),
      ('박성균', '', 23000::bigint, null::text),
      ('조성범', '', 280000::bigint, null::text),
      ('송병철', '', 5000::bigint, null::text),
      ('리버사이드 호텔 객실팀', '', 406000::bigint, null::text),
      ('송헌재', '', 115000::bigint, null::text),
      ('김민성', '', 81000::bigint, null::text),
      ('권세현', '', 505000::bigint, null::text)
    ) as seed(name, phone, balance, memo)
  loop
    select id into v_customer_id
    from public.prepaid_customers
    where lower(btrim(name)) = lower(btrim(v_seed.name))
    order by (deleted_at is null) desc, created_at, id
    limit 1;

    if v_customer_id is null then
      insert into public.prepaid_customers(
        name, phone, memo, created_by, created_by_name
      ) values (
        v_seed.name, v_seed.phone, v_seed.memo, v_operator.id, v_operator.name
      )
      returning id into v_customer_id;
    else
      update public.prepaid_customers
      set name = v_seed.name,
          phone = v_seed.phone,
          company_name = null,
          contact_person = null,
          memo = v_seed.memo,
          deleted_at = null,
          deleted_by = null
      where id = v_customer_id;
    end if;

    -- 같은 이름으로 중복된 고객은 거래와 고객 모두 소프트 삭제합니다.
    for v_duplicate in
      select id from public.prepaid_customers
      where lower(btrim(name)) = lower(btrim(v_seed.name))
        and id <> v_customer_id
        and deleted_at is null
    loop
      update public.prepaid_transactions
      set deleted_at = now(), deleted_by = v_operator.id
      where customer_id = v_duplicate.id and deleted_at is null;

      update public.prepaid_customers
      set deleted_at = now(), deleted_by = v_operator.id
      where id = v_duplicate.id;
    end loop;

    -- 요청대로 과거 거래를 남기지 않고 현재 잔액 선결제 1건만 활성화합니다.
    update public.prepaid_transactions
    set deleted_at = now(), deleted_by = v_operator.id
    where customer_id = v_customer_id and deleted_at is null;

    insert into public.prepaid_transactions(
      customer_id,
      transaction_type,
      amount,
      effect_amount,
      transaction_date,
      memo,
      created_by,
      created_by_name
    ) values (
      v_customer_id,
      'deposit',
      v_seed.balance,
      v_seed.balance,
      v_today,
      null,
      v_operator.id,
      v_operator.name
    );

    select coalesce(sum(effect_amount), 0) into v_balance
    from public.prepaid_transactions
    where customer_id = v_customer_id and deleted_at is null;

    if v_balance <> v_seed.balance then
      raise exception '% 고객 잔액 검증 실패: 기대 %, 실제 %',
        v_seed.name, v_seed.balance, v_balance;
    end if;
  end loop;

  select count(*) into v_count
  from public.prepaid_customers c
  where c.deleted_at is null
    and c.name in (
      '오픈', '박병문', '갤러리', '서든포스트', '이승미', '손지원', '윤정준',
      '올케어 성형외과', '김가희', '박성균', '조성범', '송병철',
      '리버사이드 호텔 객실팀', '송헌재', '김민성', '권세현'
    );

  if v_count <> 16 then
    raise exception '초기 선결제 고객 수 검증 실패: 기대 16명, 실제 %명', v_count;
  end if;

  if exists (
    select 1
    from public.prepaid_customers c
    where c.deleted_at is null
      and c.name in (
        '오픈', '박병문', '갤러리', '서든포스트', '이승미', '손지원', '윤정준',
        '올케어 성형외과', '김가희', '박성균', '조성범', '송병철',
        '리버사이드 호텔 객실팀', '송헌재', '김민성', '권세현'
      )
    group by lower(btrim(c.name))
    having count(*) > 1
  ) then
    raise exception '초기 선결제 고객 중복 검증에 실패했습니다.';
  end if;
end;
$$;
