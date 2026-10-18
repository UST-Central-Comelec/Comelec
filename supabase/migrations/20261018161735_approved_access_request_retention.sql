-- Keep approved access requests as official and legal records. The existing cron schedule
-- continues to call this function; pending and declined requests keep the 60-day limit.
begin;
create or replace function public.delete_expired_access_requests() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted integer;
begin
  delete from public.access_requests
  where status <> 'approved' and created_at < now() - interval '60 days';
  get diagnostics deleted = row_count;
  return deleted;
end $$;
revoke all on function public.delete_expired_access_requests() from public, anon, authenticated;

-- Publish revised notices as new versions. The original version 1 stays in source;
-- previously saved versions and recorded acceptances are never changed.
lock table public.onboarding_documents in share row exclusive mode;

-- privacy-notice: databases still using the default text receive version 2.
insert into public.onboarding_documents(key,version,title,statement,body,saved_by)
select 'privacy-notice',2,'Data Privacy Notice and Consent Form','I have read and understood this Notice, and I freely and expressly consent to the collection and processing of my personal data by the UST Central Commission on Elections for the purposes stated herein.','The UST Central Commission on Elections (“the Commission”) recognizes its obligation to protect the personal data entrusted to it. This Notice sets forth the personal data the Commission collects when a person requests access to the Commission Portal (“the Portal”) and completes onboarding, the purposes for which such data are processed, the persons to whom they are disclosed, and the measures by which they are protected. It is issued in accordance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, its Implementing Rules and Regulations, and the data privacy policies of the University of Santo Tomas (“the University”).

## 1. Personal data collected
The Commission collects the following:
- full name, student number, UST email address, mobile number and Facebook profile link;
- college or faculty, academic program and year level;
- unit, position and role in the Commission;
- where the person was recruited, the particulars of the accepted application;
- the acceptance of each onboarding document, together with the date and time of acceptance; and
- records of activity in the Portal, including sign-ins and changes made.

## 2. Purposes of processing
Personal data are processed for the following purposes:
- to verify that the person is a bona fide student of the University and a Member of the Commission;
- to create and administer the person’s Portal account and determine the access it grants;
- to list the person in the Commission’s Directory and, where the role so requires, in “Meet the commission” on the Commission’s website;
- to communicate with the person on duties, meetings and other official matters;
- to keep a record of undertakings and declarations, as the Constitution, the Elections Code and University rules require; and
- to secure the Portal and investigate any misuse of it.

## 3. Disclosure
Personal data are accessible to the Executive Board and to the officers charged with administering accounts for the person’s unit. The person’s name, role, unit, UST email address, Facebook profile link and photograph are shown in the Directory to other Members. The name, role and photograph may be published on the Commission’s public website.

The Commission does not sell personal data, and does not disclose them outside the University except where the law requires or the person consents. Service providers engaged to host the Portal and its files process personal data on the Commission’s behalf and under appropriate contractual and technical safeguards.

## 4. Retention
- Requests for access that are not approved are deleted sixty (60) days after submission. Approved requests, account details and accepted agreements are retained as official and legal records of the Commission, subject to the retention requirements for a Member’s records.
- A Member’s account and declarations are retained for the duration of service and for up to one (1) academic year after the end of the Member’s term, for purposes of turnover and accountability. They are thereafter deleted or anonymized, unless the law or a pending case requires their longer retention.

## 5. Security measures
Only verified UST Google accounts may sign in to the Portal. All connections are encrypted, and each Member is granted access only to what the Member’s position requires. Members who handle personal data are bound by the Confidentiality Agreement.

## 6. Rights of the data subject
Under the Data Privacy Act of 2012, the data subject has the right to be informed, to access, to object, to rectification, to erasure or blocking, to data portability, to damages, and to file a complaint with the National Privacy Commission. Any of these rights may be exercised by writing to comelec@ust.edu.ph. The data subject may also contact the University’s Data Protection Officer.

## 7. Consent
By ticking the box below, the person certifies that they have read and understood this Notice, that the information they provide is true and correct, and that they freely and expressly consent to the processing of their personal data for the purposes stated herein. Consent may be withdrawn at any time by written notice to the Commission. Withdrawal of consent shall terminate the person’s access to the Portal, as the Portal cannot operate without it.','retention-policy-update'
where not exists (select 1 from public.onboarding_documents where key='privacy-notice');

-- If a customized version still has the old clause, replace only that clause in a new version.
insert into public.onboarding_documents(key,version,title,statement,body,saved_by)
select key,version+1,title,statement,replace(body,'- A request for access is deleted sixty (60) days after its submission.','- Requests for access that are not approved are deleted sixty (60) days after submission. Approved requests, account details and accepted agreements are retained as official and legal records of the Commission, subject to the retention requirements for a Member’s records.'),'retention-policy-update'
from (select * from public.onboarding_documents where key='privacy-notice' order by version desc limit 1) as current
where strpos(body,'- A request for access is deleted sixty (60) days after its submission.') > 0;

-- privacy-policy: databases still using the default text receive version 2.
insert into public.onboarding_documents(key,version,title,statement,body,saved_by)
select 'privacy-policy',2,'Privacy Policy','I have read and understood the Privacy Policy, and I agree to comply with it.','This Policy governs the handling of personal data in the Commission Portal, both the Member’s own and that of the students, applicants and candidates with whom the Member works. It shall be read together with the Data Privacy Notice to which the Member consented.

## 1. The Member’s personal data
The Portal keeps the Member’s profile, access, onboarding declarations and the times of their acceptance, and records of the Member’s activity. These are processed as the Data Privacy Notice provides.

## 2. Personal data handled by the Member
In handling the personal data of others, the Member shall:
1. collect only what a task requires, and use it solely for that task;
2. keep it within the Portal and the official tools of the Commission;
3. retain no personal copies, and delete working files upon the completion of a task;
4. share it only with Members who require it for their duties; and
5. report any personal data breach to the Executive Board within twenty-four (24) hours.

## 3. Cookies and sessions
The Portal uses only essential cookies, to keep the Member signed in and secure. A session closes after thirty (30) minutes of inactivity, and ends after eight (8) hours. The Portal uses no advertising cookies.

## 4. Storage and security
Personal data are stored with the Commission’s hosting and storage providers and are encrypted in transit. Access is limited by unit and position, and all changes are logged.

## 5. Retention
Applications and requests for access that are not approved are deleted sixty (60) days after submission. Approved access requests, account details and accepted agreements are retained as official and legal records of the Commission, as the Data Privacy Notice provides.

## 6. Inquiries
Questions, requests and complaints concerning privacy shall be addressed to comelec@ust.edu.ph.','retention-policy-update'
where not exists (select 1 from public.onboarding_documents where key='privacy-policy');

-- If a customized version still has the old clause, replace only that clause in a new version.
insert into public.onboarding_documents(key,version,title,statement,body,saved_by)
select key,version+1,title,statement,replace(body,'Applications and requests for access are deleted sixty (60) days after their submission. Accounts and declarations are retained as the Data Privacy Notice provides.','Applications and requests for access that are not approved are deleted sixty (60) days after submission. Approved access requests, account details and accepted agreements are retained as official and legal records of the Commission, as the Data Privacy Notice provides.'),'retention-policy-update'
from (select * from public.onboarding_documents where key='privacy-policy' order by version desc limit 1) as current
where strpos(body,'Applications and requests for access are deleted sixty (60) days after their submission. Accounts and declarations are retained as the Data Privacy Notice provides.') > 0;

notify pgrst, 'reload schema';
commit;
