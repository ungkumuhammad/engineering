/*
 * BTM gas engine project engine.
 *
 * One file shared by the dashboard (inlined into assets/dashboard.html by
 * build_dashboard.mjs) and the command line tool (btm.mjs). It holds the
 * project file format, the stage and question catalogue, load data import,
 * and every calculation for the Stage 3 exercises, so the agent and the
 * dashboard always produce the same numbers.
 *
 * Formulas follow the BTM Gas Engine Playbook and its sizing calculator.
 * No dependencies. Works in Node (CommonJS) and in the browser (window.BTM).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BTM = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA = 'btm-gas-engine-project';
  var VERSION = 1;
  var SQRT3 = Math.sqrt(3);
  var MMBTU_PER_MWH = 3.412;
  var LHV_TO_HHV = 1.108;

  // ---------------------------------------------------------------------------
  // Defaults (sizing calculator example values from the playbook)
  // ---------------------------------------------------------------------------
  var CALC_DEFAULTS = {
    target: 10, red: 'N+1', pf: 0.8, peak: 15, minload: 5, ambient: 35, alt: 50, mn: 75, override: null,
    vconn: 11, ifault: 9, rating: 16, xd: 15, zt: 7, lhv: 9.7, gas: 6, tariff: 120, cf: 85, avail: 95, req: 95,
    run_mode: 'economic', run_hours: '0-24', run_days: 'all', import_margin_mw: 0.5, demand_credit_pct: 50,
    years: 15, discount_pct: 10, tariff_esc_pct: 2, gas_esc_pct: 2, om_esc_pct: 2, ppa_irr_pct: 12,
    contingency_pct: 10, switchgear_upgrade: 0, gas_connection: 0, heat_recovery: 0, development: 0,
    staff_per_yr: 0, insurance_pct: 0.5, heat_frac: 42, boiler_eff: 90, motor_ka: 0
  };

  var ENGINE_CLASSES = [
    { mw: 1.0, eff: 40.5, min: 50, kv: 0.4, om: 18, cx: 1500 },
    { mw: 2.0, eff: 42.0, min: 50, kv: 0.69, om: 15, cx: 1350 },
    { mw: 3.3, eff: 43.0, min: 50, kv: 11, om: 13, cx: 1250 },
    { mw: 4.5, eff: 44.0, min: 50, kv: 11, om: 11, cx: 1150 },
    { mw: 10, eff: 46.5, min: 50, kv: 11, om: 9, cx: 1050 }
  ];

  // ---------------------------------------------------------------------------
  // Question catalogue. One entry per field. Keys are flat dotted strings
  // stored in project.fields. req = needed to complete the stage
  // (an answer of "unknown" with a note also counts).
  // ---------------------------------------------------------------------------
  function f(k, l, t, o) {
    o = o || {};
    return { k: k, l: l, t: t, u: o.u || '', req: !!o.req, opts: o.opts || null, help: o.help || '', fb: o.fb || '', calc: o.calc || null };
  }
  var YNU = ['Yes', 'No', 'Unknown'];

  var STAGES = [
    {
      n: 0, key: 'prep', short: 'Prepare', title: 'Stage 0 · Before the first meeting', when: 'Week 0 (about 1 week)',
      goal: 'Do the desk research, send a short pre-meeting request, and build a first hypothesis so you walk into the meeting with a ballpark.',
      groups: [
        { title: 'Project and people', fields: [
          f('meta.project_name', 'Project name', 'text', { req: 1, help: 'Short name used for the file, e.g. "ACME Plant 2 BTM".' }),
          f('client.name', 'Client company', 'text', { req: 1 }),
          f('client.industry', 'Industry', 'text', { req: 1, help: 'e.g. food processing, glove manufacturing, data centre.' }),
          f('client.site_name', 'Site name', 'text'),
          f('client.contact', 'Main client contact (name, role)', 'text'),
          f('team.tsm', 'Technical solution manager (you)', 'text', { req: 1 }),
          f('team.account_lead', 'Account or sales lead', 'text'),
          f('meeting.date', 'Target date for the discovery meeting', 'date'),
          f('meta.currency', 'Currency for all prices', 'text', { req: 1, help: 'ISO code, e.g. USD, MYR, EUR. All prices in the file use it.' })
        ] },
        { title: 'Site location and climate', fields: [
          f('site.city', 'City or town', 'text', { req: 1 }),
          f('site.country', 'Country', 'text', { req: 1, help: 'Sets the utility rules, permits and tariff to research.' }),
          f('site.altitude_m', 'Site altitude', 'number', { u: 'm', req: 1, calc: 'alt', help: 'Above 500 m the engine derates about 1% per 100 m.', fb: 'Read it from a topographic map or an elevation website for the address.' }),
          f('site.hot_day_temp_c', 'Hot-day air temperature', 'number', { u: '°C', req: 1, calc: 'ambient', help: 'Design hot-day (about 1% exceedance). Above 30 °C the engine derates about 1% per °C.', fb: 'Use the nearest weather station design temperature (ASHRAE 1% cooling) or the client\'s HVAC design basis.' }),
          f('site.notes', 'Site notes (access, neighbours, flood risk)', 'textarea')
        ] },
        { title: 'Utility and tariff', fields: [
          f('utility.name', 'Electricity utility', 'text', { req: 1 }),
          f('tariff.class', 'Tariff class or category', 'text', { req: 1, help: 'From the regulator\'s published tariff book or the supply contract.' }),
          f('tariff.energy_rate', 'Average energy charge', 'number', { u: 'per MWh', req: 1, calc: 'tariff', help: 'Energy part only, in the project currency per MWh. Time-of-use bands go in the Tariff tab.', fb: 'Use the regulator\'s published tariff for the class. Show payback at ±15%.' }),
          f('tariff.demand_charge', 'Demand (maximum demand) charge', 'number', { u: 'per kW-month', help: 'Leave empty if the tariff has none.' }),
          f('tariff.has_tou', 'Time-of-use (peak / off-peak) rates?', 'select', { opts: YNU }),
          f('tariff.source', 'Where the tariff came from', 'text')
        ] },
        { title: 'Gas', fields: [
          f('gas.availability', 'Gas availability at the site', 'select', { req: 1, opts: ['Pipeline at site', 'Pipeline nearby', 'No pipeline (CNG or LNG needed)', 'Unknown'], help: 'The biggest project risk. Check the gas network map.' }),
          f('gas.distributor', 'Gas distributor or supplier', 'text'),
          f('gas.price_per_mmbtu', 'Indicative gas price (HHV)', 'number', { u: 'per MMBtu', req: 1, calc: 'gas', fb: 'Use the published regulated industrial gas tariff, or a recent supplier quote for a similar user.' }),
          f('gas.lhv_kwh_nm3', 'Gas heating value (LHV)', 'number', { u: 'kWh/Nm³', calc: 'lhv', help: 'Typical pipeline gas 9.5 to 10.' }),
          f('gas.methane_number', 'Gas methane number', 'number', { calc: 'mn', help: 'Below 70 the engine derates. Typical pipeline gas 70 to 90.' })
        ] },
        { title: 'Rules and permits (desk research)', fields: [
          f('reg.parallel_allowed', 'Does the utility allow generation in parallel with the grid?', 'select', { req: 1, opts: ['Yes', 'Yes, with conditions', 'No', 'Unknown'] }),
          f('reg.export_allowed', 'Is export to the grid allowed?', 'select', { opts: ['Yes', 'With a separate agreement', 'No', 'Unknown'] }),
          f('reg.licence', 'Generation or captive power licence needed?', 'text'),
          f('reg.emissions', 'Emission and noise limits that apply', 'textarea')
        ] },
        { title: 'Client operations (what you can learn before the meeting)', fields: [
          f('client.shifts', 'Shifts and operating days', 'text'),
          f('client.expansion', 'Known expansion plans', 'textarea'),
          f('target.size_mw', 'Size the client has in mind', 'number', { u: 'MW', calc: 'target', help: 'Leave empty if they have not said. The playbook default is 10 MW.' })
        ] },
        { title: 'First look from the bills', fields: [
          f('bills.max_kw', 'Maximum demand from the bills', 'number', { u: 'kW', help: 'Highest monthly maximum demand. Feeds the first hypothesis until interval data arrives.' }),
          f('bills.annual_mwh', 'Annual consumption from the bills', 'number', { u: 'MWh' })
        ] },
        { title: 'Pre-meeting data request', fields: [
          f('pmr.sent_date', 'Date the short pre-meeting request was sent', 'date', { req: 1 }),
          f('pmr.bills', '12 months of electricity bills received', 'bool'),
          f('pmr.sld', 'Single line diagram received', 'bool'),
          f('pmr.site_plan', 'Site plan received', 'bool'),
          f('pmr.load_data', 'Load data received (BMS, SCADA or utility portal)', 'bool')
        ] },
        { title: 'Meeting pack', fields: [
          f('pack.one_pager', 'Playbook one-page summary ready', 'bool'),
          f('pack.references', '2 or 3 reference projects ready', 'bool'),
          f('pack.configs', 'Typical configurations sheet ready', 'bool'),
          f('pack.indicative_cost', 'Indicative generation cost per MWh ready', 'bool'),
          f('pack.nda', 'NDA signed or not needed', 'bool')
        ] }
      ],
      deliverables: [
        { id: 's0-brief', title: 'Desk research brief', by: 'agent' },
        { id: 's0-request', title: 'Pre-meeting data request (email)', by: 'agent' },
        { id: 's0-hypothesis', title: 'First hypothesis (ballpark)', by: 'cli' },
        { id: 's0-pack', title: 'Meeting pack checklist', by: 'agent' }
      ]
    },
    {
      n: 1, key: 'discovery', short: 'Discover', title: 'Stage 1 · Discovery meeting', when: 'Week 1 (2 to 3 hours plus a site walk)',
      goal: 'Leave the meeting with the client\'s four objective answers, the electrical facts from the SLD, the commercial picture, a site walk record and an agreed data request.',
      groups: [
        { title: 'Meeting', fields: [
          f('s1.meeting_date', 'Meeting date', 'date', { req: 1 }),
          f('s1.attendees', 'Attendees (name, role, company)', 'textarea', { req: 1 })
        ] },
        { title: 'Drivers and constraints (the four answers)', fields: [
          f('obj.drivers', 'Why do they want it?', 'multi', { req: 1, opts: ['Lower energy cost', 'Reliability or backup', 'Power quality', 'Heat or cooling (CHP)', 'Sustainability'] }),
          f('obj.operating_mode', 'How will it run?', 'select', { req: 1, opts: ['Baseload', 'Peak shaving', 'Island (prime power)', 'Backup only'] }),
          f('obj.grid_mode', 'In parallel with the grid or stand-alone?', 'select', { req: 1, opts: ['Grid parallel', 'Stand-alone'] }),
          f('obj.export', 'Export or no export?', 'select', { req: 1, opts: ['Zero export', 'Export allowed', 'Unknown'] }),
          f('obj.gas_source', 'Gas source', 'select', { req: 1, opts: ['Pipeline', 'CNG', 'LNG', 'Biogas or other', 'Unknown'] })
        ] },
        { title: 'Operations', fields: [
          f('ops.min_load_mw', 'Lowest site load (nights, weekends, holidays)', 'number', { u: 'MW', req: 1, help: 'Sets the zero-export limit. Interval data replaces this once it arrives.', fb: 'Ask for the lowest reading on the main incomer meter, or a night-time spot reading.' }),
          f('ops.peak_load_mw', 'Peak site load', 'number', { u: 'MW' }),
          f('ops.shifts', 'Shifts, weekend and holiday operation', 'text'),
          f('ops.critical_loads', 'Critical loads', 'textarea'),
          f('ops.outages', 'Outage history (how often, how long, cost)', 'textarea'),
          f('ops.pq_issues', 'Power quality problems (dips, flicker, harmonics)', 'textarea'),
          f('ops.large_motors', 'Large motors and how they start', 'textarea'),
          f('ops.growth', 'Growth or expansion plans', 'textarea')
        ] },
        { title: 'Electrical (walk through the SLD with their electrical engineer)', fields: [
          f('elec.connection_kv', 'Connection voltage at the candidate bus', 'number', { u: 'kV', req: 1, calc: 'vconn' }),
          f('elec.candidate_bus', 'Candidate tapping point (board and bus section)', 'text'),
          f('elec.spare_bay', 'Spare breaker bay?', 'select', { req: 1, opts: ['Spare bay available', 'Board can be extended', 'No, new generator board needed', 'Unknown'] }),
          f('elec.switchgear_rating_ka', 'Switchboard short-circuit rating', 'number', { u: 'kA', req: 1, calc: 'rating', fb: 'Read the panel nameplate. If unknown assume a conservative 12.5 kA until verified.' }),
          f('elec.switchgear_making_ka', 'Switchboard making (peak) rating', 'number', { u: 'kA peak', help: 'Leave empty to use 2.5 × the short-circuit rating.' }),
          f('elec.switchgear_year', 'Switchboard year of manufacture', 'number'),
          f('elec.tx_mva', 'Utility transformer rating', 'number', { u: 'MVA' }),
          f('elec.tx_z_pct', 'Utility transformer impedance', 'number', { u: '%', fb: 'Typical 6 to 10% for 5 to 25 MVA units.' }),
          f('elec.tx_count', 'Transformers feeding the bus in parallel', 'number', { help: 'Usually 1 when the bus tie is normally open.' }),
          f('elec.grid_fault_mva', 'Utility fault level at the point of connection', 'number', { u: 'MVA', help: 'Ask the utility. Leave empty to ignore the grid impedance (worst case).' }),
          f('elec.existing_fault_ka', 'Existing fault level at the bus, if already known', 'number', { u: 'kA', help: 'From a utility letter or a previous study. Overrides the transformer estimate.' }),
          f('elec.motor_ka', 'Motor contribution to fault current', 'number', { u: 'kA', help: 'Large running motors feed a fault for a few cycles. Roughly 4 to 6 × their rated current.' }),
          f('elec.bus_tie', 'Bus tie operation', 'select', { opts: ['Normally open', 'Normally closed', 'No bus tie', 'Unknown'] }),
          f('elec.incomer_rating_a', 'Incomer breaker rating', 'number', { u: 'A' }),
          f('elec.busbar_rating_a', 'Busbar rating', 'number', { u: 'A' }),
          f('elec.relays', 'Relay make and model', 'text'),
          f('elec.last_study', 'Last protection coordination study (year, by whom)', 'text'),
          f('elec.utility_restrictions', 'Has the utility ever restricted on-site generation here?', 'textarea')
        ] },
        { title: 'Gas and thermal needs', fields: [
          f('gas.pressure_bar', 'Gas pressure available at the tie-in', 'number', { u: 'bar(g)' }),
          f('gas.tie_in', 'Gas tie-in point', 'text'),
          f('heat.enabled', 'Is there a heat or cooling user?', 'select', { opts: ['Yes', 'Possible', 'No'] }),
          f('heat.type', 'Heat use (steam, hot water, chilled water)', 'text'),
          f('heat.demand_mw', 'Average thermal demand', 'number', { u: 'MWth' }),
          f('heat.hours', 'Hours per year with that demand', 'number', { u: 'h/yr' }),
          f('heat.boiler_eff', 'Efficiency of the boiler or chiller it replaces', 'number', { u: '%', calc: 'boiler_eff' })
        ] },
        { title: 'Commercial and decision process', fields: [
          f('com.model', 'Capex purchase or PPA?', 'select', { req: 1, opts: ['Capex purchase', 'PPA or energy-as-a-service', 'Both or undecided'] }),
          f('com.payback_max_yr', 'Maximum acceptable payback', 'number', { u: 'years' }),
          f('com.irr_min_pct', 'Minimum IRR (hurdle)', 'number', { u: '%' }),
          f('com.decision_maker', 'Who decides and who signs', 'text', { req: 1 }),
          f('com.budget_cycle', 'Budget cycle', 'text'),
          f('com.timeline', 'Target timeline', 'text'),
          f('com.failure_criteria', 'What would make this fail internally?', 'textarea')
        ] },
        { title: 'Site walk checklist', fields: [
          f('walk.board', 'MV switchboard nameplate photographed (kV, A, kA, year)', 'bool'),
          f('walk.spare_bay', 'Spare bay or end-panel space checked', 'bool'),
          f('walk.tx', 'Transformer nameplates photographed (MVA, %Z, vector group)', 'bool'),
          f('walk.relays', 'Relay make and model recorded', 'bool'),
          f('walk.meter', 'Revenue meter and PCC located', 'bool'),
          f('walk.location', 'Engine hall or container area identified', 'bool'),
          f('walk.access', 'Crane and truck access checked', 'bool'),
          f('walk.gas', 'Gas tie-in point and pressure seen', 'bool'),
          f('walk.heat', 'Boilers and chillers seen', 'bool'),
          f('walk.noise', 'Noise receptors noted', 'bool'),
          f('walk.stack', 'Stack height limits noted', 'bool'),
          f('walk.notes', 'Site walk notes and photo references', 'textarea')
        ] },
        { title: 'Next steps', fields: [
          f('s1.data_owners_agreed', 'Data request agreed with an owner and date for each item', 'bool', { req: 1 }),
          f('s1.proposal_meeting_date', 'Date for the proposal meeting', 'date')
        ] }
      ],
      deliverables: [
        { id: 's1-pack', title: 'Meeting agenda, question sheet and site walk checklist', by: 'cli' },
        { id: 's1-notes', title: 'Meeting notes and agreed next steps', by: 'agent' }
      ]
    },
    {
      n: 2, key: 'data', short: 'Request data', title: 'Stage 2 · Formal data request', when: 'Send within 48 hours of the meeting',
      goal: 'Send the data request with an owner and date per item, and track it. A missing item never stops the work: use the playbook fallback and log the assumption.',
      groups: [
        { title: 'Request', fields: [
          f('s2.sent_date', 'Date the formal data request was sent', 'date', { req: 1 }),
          f('s2.sent_to', 'Sent to (name, role)', 'text')
        ] }
      ],
      deliverables: [
        { id: 's2-request', title: 'Formal data request (table and email)', by: 'cli' }
      ]
    },
    {
      n: 3, key: 'exercises', short: 'Analyse', title: 'Stage 3 · Exercises to build the proposal', when: 'Weeks 1 to 4',
      goal: 'Run exercises E1 to E14, check the go/no-go gates early, and get the internal review signed off.',
      groups: [
        { title: 'Sizing inputs (leave empty to use project data or defaults)', fields: [
          f('calc.target', 'Output needed at generator terminals', 'number', { u: 'MW' }),
          f('calc.red', 'Redundancy', 'select', { opts: ['N', 'N+1'] }),
          f('calc.pf', 'Generator power factor', 'number'),
          f('calc.peak', 'Site peak demand', 'number', { u: 'MW' }),
          f('calc.minload', 'Site minimum demand', 'number', { u: 'MW' }),
          f('calc.ambient', 'Hot-day air temperature', 'number', { u: '°C' }),
          f('calc.alt', 'Altitude', 'number', { u: 'm' }),
          f('calc.mn', 'Gas methane number', 'number'),
          f('calc.override', 'Derate override', 'number', { u: '%' }),
          f('calc.avail', 'Availability of one unit (incl. maintenance)', 'number', { u: '%' }),
          f('calc.req', 'Required chance of full output', 'number', { u: '%' }),
          f('calc.cf', 'Capacity factor (used only without load data)', 'number', { u: '%' })
        ] },
        { title: 'Grid and switchboard inputs', fields: [
          f('calc.vconn', 'Connection voltage', 'number', { u: 'kV' }),
          f('calc.ifault', 'Existing fault level at the bus (utility + motors)', 'number', { u: 'kA' }),
          f('calc.rating', 'Switchboard short-circuit rating', 'number', { u: 'kA' }),
          f('calc.xd', 'Generator X″d', 'number', { u: '%' }),
          f('calc.zt', 'Step-up transformer impedance', 'number', { u: '%' })
        ] },
        { title: 'Dispatch (how the engines run against the load data)', fields: [
          f('calc.run_mode', 'Running rule', 'select', { opts: ['economic', 'always', 'hours'], help: 'economic = run in hours when the tariff is above the generation cost; hours = use the window below.' }),
          f('calc.run_hours', 'Running window (hours)', 'text', { help: 'e.g. 7-23. Used when the running rule is "hours".' }),
          f('calc.run_days', 'Running days', 'select', { opts: ['all', 'weekdays'] }),
          f('calc.import_margin_mw', 'Import margin kept by the zero-export controller', 'number', { u: 'MW' }),
          f('calc.demand_credit_pct', 'Share of demand-charge saving to credit', 'number', { u: '%', help: 'One engine trip at the monthly peak can wipe out the saving, so credit only part of it.' })
        ] },
        { title: 'Fuel and heat', fields: [
          f('calc.gas', 'Gas price (HHV)', 'number', { u: 'per MMBtu' }),
          f('calc.lhv', 'Gas heating value (LHV)', 'number', { u: 'kWh/Nm³' }),
          f('calc.tariff', 'Grid energy tariff avoided (base rate)', 'number', { u: 'per MWh' }),
          f('calc.heat_frac', 'Recoverable heat as share of fuel', 'number', { u: '%' })
        ] },
        { title: 'Cost and finance', fields: [
          f('calc.contingency_pct', 'Contingency', 'number', { u: '%' }),
          f('calc.switchgear_upgrade', 'Switchgear upgrade or reactors', 'number', { u: 'currency' }),
          f('calc.gas_connection', 'Gas connection or gas station', 'number', { u: 'currency' }),
          f('calc.heat_recovery', 'Heat recovery equipment (only if heat is used)', 'number', { u: 'currency' }),
          f('calc.development', 'Development, studies and permits', 'number', { u: 'currency' }),
          f('calc.staff_per_yr', 'Operating staff per year', 'number', { u: 'currency/yr' }),
          f('calc.insurance_pct', 'Insurance per year', 'number', { u: '% of capex' }),
          f('calc.years', 'Evaluation period', 'number', { u: 'years' }),
          f('calc.discount_pct', 'Discount rate for NPV', 'number', { u: '%' }),
          f('calc.tariff_esc_pct', 'Tariff escalation', 'number', { u: '%/yr' }),
          f('calc.gas_esc_pct', 'Gas price escalation', 'number', { u: '%/yr' }),
          f('calc.om_esc_pct', 'O&M and fixed cost escalation', 'number', { u: '%/yr' }),
          f('calc.ppa_irr_pct', 'Investor IRR for the indicative PPA price', 'number', { u: '%' })
        ] }
      ],
      deliverables: [
        { id: 's3-results', title: 'Exercise results summary (E1 to E14)', by: 'cli' }
      ]
    },
    {
      n: 4, key: 'proposal', short: 'Propose', title: 'Stage 4 · Proposal package and presentation', when: 'Weeks 5 to 6',
      goal: 'Assemble the package, present two options side by side, and ask for a clear next step.',
      groups: [
        { title: 'Offer', fields: [
          f('s4.option_a', 'Option A (recommended)', 'text', { req: 1, help: 'e.g. 3 × 3.3 MW, N+1.' }),
          f('s4.option_b', 'Option B (alternative)', 'text'),
          f('s4.offer_type', 'Commercial offer', 'select', { req: 1, opts: ['Capex', 'PPA', 'Capex and PPA'] }),
          f('s4.next_step', 'The ask', 'select', { req: 1, opts: ['Feasibility study', 'FEED', 'Letter of intent'] }),
          f('s4.next_step_cost', 'Cost of the next step', 'number', { u: 'currency' }),
          f('s4.next_step_weeks', 'Duration of the next step', 'number', { u: 'weeks' })
        ] },
        { title: 'Package checklist', fields: [
          f('pkg.exec', 'Executive summary', 'bool', { req: 1 }),
          f('pkg.options', 'Two options compared', 'bool', { req: 1 }),
          f('pkg.sld', 'Concept SLD with tapping point', 'bool', { req: 1 }),
          f('pkg.layout', 'Site layout', 'bool'),
          f('pkg.equipment', 'Equipment list and budget BoQ', 'bool'),
          f('pkg.financial', 'Financial model with sensitivities', 'bool', { req: 1 }),
          f('pkg.offer', 'Commercial offer', 'bool', { req: 1 }),
          f('pkg.schedule', 'Schedule', 'bool'),
          f('pkg.risks', 'Risk register and assumptions log', 'bool', { req: 1 }),
          f('pkg.ask', 'The ask: scope, cost and duration of the next step', 'bool', { req: 1 })
        ] },
        { title: 'Presentation and decision', fields: [
          f('s4.presentation_date', 'Presentation date', 'date', { req: 1 }),
          f('s4.decision', 'Client decision', 'select', { opts: ['Pending', 'Accepted: feasibility study', 'Accepted: FEED', 'Letter of intent signed', 'On hold', 'Declined'] }),
          f('s4.decision_notes', 'Decision notes and follow-ups', 'textarea')
        ] }
      ],
      deliverables: [
        { id: 's4-proposal', title: 'Proposal package (draft)', by: 'cli' },
        { id: 's4-agenda', title: 'Presentation agenda', by: 'agent' },
        { id: 's4-decision', title: 'Decision record', by: 'agent' }
      ]
    }
  ];

  var FIELDS = {};
  STAGES.forEach(function (s) {
    s.groups.forEach(function (g) { g.fields.forEach(function (fd) { fd.stage = s.n; fd.group = g.title; FIELDS[fd.k] = fd; }); });
  });

  // calc input key -> project field it is resolved from (when calc.* is empty)
  var CALC_SOURCES = {
    alt: 'site.altitude_m', ambient: 'site.hot_day_temp_c', tariff: 'tariff.energy_rate', gas: 'gas.price_per_mmbtu',
    lhv: 'gas.lhv_kwh_nm3', mn: 'gas.methane_number', target: 'target.size_mw', vconn: 'elec.connection_kv',
    rating: 'elec.switchgear_rating_ka', boiler_eff: 'heat.boiler_eff', motor_ka: 'elec.motor_ka'
  };

  var DATA_REQUEST = [
    { id: 'DR1', item: 'Interval load data, 12 months, 15 to 30 min', why: 'Sizing, minimum load, savings', owner: 'Client or utility', due: 'Week 2', ex: 'E2', fallback: 'Utility smart-meter export (client signs the request); BMS, SCADA or historian trends; a power logger on the main incomer for 2 to 4 weeks scaled with the bills; last resort connected load × shift hours × diversity.' },
    { id: 'DR2', item: 'Tariff contract and 12 months of bills', why: 'Business case', owner: 'Client', due: 'Week 1', ex: 'E3', fallback: 'Regulator\'s published tariff for the class; a one-page billing summary (kWh, maximum kW, charges). Show payback at tariff ±15%.' },
    { id: 'DR3', item: 'Utility fault level and grid code', why: 'Fault study, interconnection', owner: 'Utility (client signs the request)', due: 'Week 3+, can run late', ex: 'E5', fallback: 'Estimate the upper bound from the transformer: Isc ≈ S ÷ (√3 × V × Z%). Mark results "preliminary, subject to utility data".' },
    { id: 'DR4', item: 'As-built single line diagram', why: 'Tapping point', owner: 'Client', due: 'Week 1', ex: 'E5', fallback: 'Walk the site, photograph every panel and nameplate, redraw in CAD and have the client\'s electrical engineer sign it. Allow 3 to 5 days per MV substation.' },
    { id: 'DR5', item: 'Transformer and switchgear nameplates and test reports', why: 'Fault level, bay capacity', owner: 'Client', due: 'Week 1', ex: 'E5', fallback: 'Typical transformer impedance 6 to 10%; assume a 12.5 kA switchboard until verified. Ask the OEM for the type-test certificate.' },
    { id: 'DR6', item: 'Relay settings and last coordination study', why: 'Protection scope', owner: 'Client', due: 'Week 2', ex: 'E5', fallback: 'Put a relay settings survey and a new coordination study in scope, and price it.' },
    { id: 'DR7', item: 'Gas pressure, capacity and price', why: 'Fuel train, running cost', owner: 'Gas distributor', due: 'Week 3', ex: 'E6', fallback: 'Published industrial gas tariff; CNG, LNG or pipeline-extension quotes. Rerun the economics for each supply option.' },
    { id: 'DR8', item: 'Thermal load data (steam, hot water, chilled water)', why: 'CHP decision', owner: 'Client', due: 'Week 2', ex: 'E7', fallback: 'Run the case as electric-only with radiators.' },
    { id: 'DR9', item: 'Site layout, land and civil drawings', why: 'Engine hall, cooling, stack, gas station', owner: 'Client', due: 'Week 2', ex: 'E8', fallback: 'Satellite imagery, drone survey or site visit, plus the OEM package footprint.' },
    { id: 'DR10', item: 'Engine OEM budget quote, derate curve and generator data (X″d)', why: 'Sizing, fault level, cost', owner: 'Engine OEM (our side)', due: 'Week 2 to 3', ex: 'E4', fallback: 'Playbook example engine classes, marked as planning values.' }
  ];
  var DR_STATUS = ['Not requested', 'Requested', 'Received', 'Partial', 'Fallback used', 'Not needed'];

  var EXERCISES = [
    { id: 'E1', title: 'Assumptions log', what: 'Record every missing data item, the fallback used and the risk.', out: 'Assumptions list for the proposal', ref: 'Playbook Step 2', auto: true },
    { id: 'E2', title: 'Load profile analysis', what: 'Load duration curve, hourly heat map, peak, minimum and base load, weekday vs weekend.', out: 'Minimum load, base load, running hours', ref: 'New', auto: true },
    { id: 'E3', title: 'Tariff analysis', what: 'Blended tariff, time-of-use bands, demand charges, hours when the engine is cheaper than the grid.', out: 'Avoided cost per MWh, running window', ref: 'Step 7', auto: true },
    { id: 'E4', title: 'Sizing and configuration', what: 'Derate for site conditions, compare configurations, N vs N+1, turn-down against minimum load.', out: 'Shortlist of 2 options', ref: 'Sizing calculator', auto: true },
    { id: 'E5', title: 'Electrical screening', what: 'Mark up the SLD, run the 6 checks, hand-calculate fault level and reverse power.', out: 'Tapping point; switchboard upgrade yes or no', ref: 'Steps 3 to 4', auto: true },
    { id: 'E6', title: 'Gas supply assessment', what: 'Pipeline capacity and pressure, or CNG and LNG; delivered price; gas quality.', out: 'Gas solution and price per MMBtu', ref: 'Step 5', auto: true },
    { id: 'E7', title: 'Heat recovery screening', what: 'Match heat available with heat demand (only with a heat user).', out: 'CHP decision, heat credit', ref: 'Step 5', auto: true },
    { id: 'E8', title: 'Site layout concept', what: 'Footprint, cable and gas routes, stack, noise distances.', out: 'Layout sketch', ref: 'Step 5', auto: false },
    { id: 'E9', title: 'Permits and utility pathway', what: 'List the approvals, their durations and the critical path.', out: 'Permit plan', ref: 'Step 6', auto: false },
    { id: 'E10', title: 'Cost estimate', what: 'Capex build-up, opex and LTSA.', out: 'Budget BoQ (±30%)', ref: 'Step 7', auto: true },
    { id: 'E11', title: 'Business case', what: 'LCOE, savings, payback, IRR and NPV; sensitivities; capex vs PPA.', out: 'Financial model', ref: 'Step 7', auto: true },
    { id: 'E12', title: 'Risk register', what: 'Project-specific risks and mitigations.', out: 'Risk register', ref: 'Step 8', auto: false },
    { id: 'E13', title: 'Schedule', what: 'Studies, approvals, OEM lead time, construction, commissioning.', out: 'Milestone schedule', ref: 'Step 9', auto: false },
    { id: 'E14', title: 'Internal review', what: 'Protection engineer reviews the tapping point; commercial and pricing approval.', out: 'Go-ahead to issue', ref: 'Step 9', auto: false }
  ];
  var EX_STATUS = ['Not started', 'In progress', 'Done', 'Not applicable'];

  var RISKS = [
    { risk: 'Gas price or supply', effect: 'Savings disappear or the plant stops', mitigation: 'Fixed-price or indexed gas contract, dual-fuel option', l: 'M', i: 'H' },
    { risk: 'Utility approval delay', effect: 'Schedule slips', mitigation: 'Apply early, ask for the fault level and grid code up front', l: 'H', i: 'M' },
    { risk: 'Fault level over the switchboard rating', effect: 'Board or breakers must be replaced', mitigation: 'Run the fault study in E5, carry a contingency', l: 'M', i: 'H' },
    { risk: 'Load below engine output', effect: 'Export or curtailment', mitigation: 'Zero-export control, multiple engines, correct sizing', l: 'M', i: 'M' },
    { risk: 'Heat demand does not appear', effect: 'Lower efficiency and revenue', mitigation: 'Verify thermal loads, plan an electric-only fallback', l: 'M', i: 'M' },
    { risk: 'Emissions compliance', effect: 'Permit refused or retrofit needed', mitigation: 'Confirm limits early, specify a catalyst', l: 'L', i: 'H' },
    { risk: 'OEM lead time', effect: 'Delivery 12 to 18 months', mitigation: 'Reserve a slot early, consider stock or used units', l: 'M', i: 'M' }
  ];

  var SCHEDULE = [
    { task: 'Proposal and client decision', start: 0, weeks: 4 },
    { task: 'Feasibility or FEED incl. power system studies', start: 4, weeks: 10 },
    { task: 'Utility interconnection application and approval', start: 8, weeks: 26 },
    { task: 'Environmental, building and fire permits', start: 8, weeks: 20 },
    { task: 'Gas supply agreement', start: 8, weeks: 16 },
    { task: 'Contract award (notice to proceed)', start: 16, weeks: 2 },
    { task: 'Engine manufacture and delivery (12 to 18 months)', start: 18, weeks: 60 },
    { task: 'Detailed design', start: 18, weeks: 20 },
    { task: 'Civil works and engine hall', start: 44, weeks: 24 },
    { task: 'Installation: mechanical, electrical, gas', start: 72, weeks: 10 },
    { task: 'Commissioning and grid compliance tests', start: 82, weeks: 6 },
    { task: 'Handover and commercial operation', start: 88, weeks: 1 }
  ];

  var REVIEW = [
    { role: 'Protection engineer: tapping point and fault level', name: '', date: '', status: 'Pending', note: '' },
    { role: 'Commercial review', name: '', date: '', status: 'Pending', note: '' },
    { role: 'Pricing approval', name: '', date: '', status: 'Pending', note: '' }
  ];

  var SLD_CHECKS = [
    { id: 'C1', title: 'Fault level at the bus', auto: true },
    { id: 'C2', title: 'Busbar and incomer current', auto: true },
    { id: 'C3', title: 'Bus tie position', auto: false, hint: 'Is the minimum load of the engine\'s bus section above the engine output, or is tie logic designed?' },
    { id: 'C4', title: 'Reverse power through the transformer', auto: true },
    { id: 'C5', title: 'Earthing and transformer vector group', auto: false, hint: 'Generator neutral earthing (NGR) and vector group of any step-up transformer.' },
    { id: 'C6', title: 'Meter and PCC position', auto: false, hint: 'The engine must connect downstream of the revenue meter, with a check meter on the generator.' }
  ];
  var CHECK_STATUS = ['Not checked', 'Pass', 'Fail', 'Needs data'];

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowIso() { return new Date().toISOString().replace(/\.\d+Z$/, 'Z'); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function empty(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0); }
  function slugify(s) {
    return String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';
  }
  function fmt(n, d) {
    if (!isNum(n)) return '–';
    d = d === undefined ? 0 : d;
    var s = Math.abs(n).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + s.join('.');
  }
  function fmtMoney(n, cur) {
    if (!isNum(n)) return '–';
    var a = Math.abs(n), s;
    if (a >= 1e9) s = fmt(n / 1e9, 2) + ' bn';
    else if (a >= 1e6) s = fmt(n / 1e6, 2) + ' M';
    else if (a >= 1e4) s = fmt(n / 1e3, 0) + ' k';
    else s = fmt(n, 0);
    return (cur ? cur + ' ' : '') + s;
  }
  function percentileSorted(sorted, p) {
    if (!sorted.length) return NaN;
    var idx = (sorted.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }
  function pAtLeast(n, k, a) {
    var p = 0;
    for (var i = k; i <= n; i++) {
      var c = 1; for (var j = 1; j <= i; j++) c = c * (n - i + j) / j;
      p += c * Math.pow(a, i) * Math.pow(1 - a, n - i);
    }
    return Math.min(1, p);
  }
  // Expected share of duty capacity available: E[min(X, k)] / k, X ~ Bin(n, a)
  function expectedDutyShare(n, k, a) {
    var e = 0;
    for (var i = 0; i <= n; i++) {
      var c = 1; for (var j = 1; j <= i; j++) c = c * (n - i + j) / j;
      e += c * Math.pow(a, i) * Math.pow(1 - a, n - i) * Math.min(i, k);
    }
    return k > 0 ? e / k : 0;
  }
  function crf(r, n) { return r === 0 ? 1 / n : r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); }
  function npv(r, flows) { var s = 0; for (var i = 0; i < flows.length; i++) s += flows[i] / Math.pow(1 + r, i); return s; }
  function irr(flows) {
    var lo = -0.99, hi = 1.5, flo = npv(lo, flows), fhi = npv(hi, flows);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (var it = 0; it < 200; it++) {
      var mid = (lo + hi) / 2, fm = npv(mid, flows);
      if (Math.abs(fm) < 1e-6) return mid;
      if (fm * flo > 0) { lo = mid; flo = fm; } else { hi = mid; }
    }
    return (lo + hi) / 2;
  }

  // ---------------------------------------------------------------------------
  // Project file
  // ---------------------------------------------------------------------------
  function newProject(opts) {
    opts = opts || {};
    var t = nowIso();
    var p = {
      schema: SCHEMA, version: VERSION, created: t, updated: t,
      fields: {}, unknown: {},
      stages: STAGES.map(function (s) { return { n: s.n, status: s.n === 0 ? 'in_progress' : 'not_started', started: s.n === 0 ? t : null, completed: null, skip_reason: null }; }),
      current_stage: 0,
      load: null, bills: [],
      tariff_periods: [],
      engine_classes: clone(ENGINE_CLASSES),
      data_request: DATA_REQUEST.map(function (d) { return { id: d.id, item: d.item, why: d.why, owner: d.owner, due: d.due, status: 'Not requested', received: '', note: '', fallback: d.fallback, ex: d.ex }; }),
      exercises: EXERCISES.map(function (e) { return { id: e.id, status: 'Not started', note: '' }; }),
      checks: SLD_CHECKS.map(function (c) { return { id: c.id, status: 'Not checked', note: '' }; }),
      gas_options: [
        { name: 'Pipeline gas', price: null, note: 'Leave the price empty to use the project gas price' },
        { name: 'Trucked CNG (virtual pipeline)', price: null, note: '' },
        { name: 'LNG with storage and vaporizer', price: null, note: '' }
      ],
      assumptions: [], risks: clone(RISKS), schedule: clone(SCHEDULE), review: clone(REVIEW),
      selected_options: [],
      deliverables: [], log: [], results: null
    };
    if (opts.name) p.fields['meta.project_name'] = opts.name;
    if (opts.client) p.fields['client.name'] = opts.client;
    if (opts.currency) p.fields['meta.currency'] = opts.currency;
    addLog(p, 'Project created', opts.by || 'system');
    return p;
  }

  function addLog(p, text, who) {
    p.log = p.log || [];
    p.log.push({ t: nowIso(), who: who || 'user', text: text });
    if (p.log.length > 500) p.log = p.log.slice(-500);
  }

  // Fill in anything missing from older or hand-edited files.
  function migrate(p) {
    var base = newProject();
    ['fields', 'unknown', 'bills', 'tariff_periods', 'assumptions', 'risks', 'schedule', 'review', 'selected_options', 'deliverables', 'log', 'gas_options'].forEach(function (k) {
      if (p[k] === undefined || p[k] === null) p[k] = base[k];
    });
    if (!Array.isArray(p.engine_classes) || !p.engine_classes.length) p.engine_classes = base.engine_classes;
    if (!Array.isArray(p.stages) || p.stages.length !== STAGES.length) p.stages = base.stages;
    if (!isNum(p.current_stage)) p.current_stage = 0;
    ['data_request', 'exercises', 'checks'].forEach(function (k) {
      if (!Array.isArray(p[k])) { p[k] = base[k]; return; }
      base[k].forEach(function (row) { if (!p[k].some(function (r) { return r.id === row.id; })) p[k].push(row); });
    });
    if (p.load === undefined) p.load = null;
    p.schema = SCHEMA; p.version = VERSION;
    return p;
  }

  function validate(p) {
    var errors = [], warnings = [];
    if (!p || typeof p !== 'object') return { errors: ['Not a JSON object'], warnings: [] };
    if (p.schema !== SCHEMA) errors.push('This is not a BTM gas engine project file (schema "' + p.schema + '").');
    if (p.version > VERSION) warnings.push('File version ' + p.version + ' is newer than this tool (' + VERSION + ').');
    Object.keys(p.fields || {}).forEach(function (k) { if (!FIELDS[k]) warnings.push('Unknown field "' + k + '" is kept but not used.'); });
    if (p.load) {
      if (!p.load.start || !isNum(p.load.interval_min) || !Array.isArray(p.load.kw)) errors.push('Load data is malformed.');
    }
    return { errors: errors, warnings: warnings };
  }

  function parseProject(text) {
    var p;
    try { p = JSON.parse(text); } catch (e) { throw new Error('The file is not valid JSON: ' + e.message); }
    var v = validate(p);
    if (v.errors.length) throw new Error(v.errors.join(' '));
    return migrate(p);
  }

  function serialize(p) {
    p.updated = nowIso();
    return JSON.stringify(p, function (k, v) { return k === 'results' ? undefined : v; }, 1);
  }

  function fileName(p) { return slugify(p.fields['meta.project_name'] || p.fields['client.name'] || 'project') + '.btm.json'; }

  // Parse a raw value for a field according to its type.
  function parseValue(fd, raw) {
    if (raw === null || raw === undefined) return null;
    if (fd && fd.t === 'bool') {
      if (typeof raw === 'boolean') return raw;
      var s = String(raw).trim().toLowerCase();
      if (s === '') return null;
      return ['1', 'true', 'yes', 'y', 'done', 'x'].indexOf(s) >= 0;
    }
    if (fd && fd.t === 'number') {
      if (typeof raw === 'number') return isFinite(raw) ? raw : null;
      var t = String(raw).trim().replace(/,/g, '');
      if (t === '') return null;
      var n = Number(t);
      if (!isFinite(n)) throw new Error('"' + raw + '" is not a number for ' + fd.l);
      return n;
    }
    if (fd && fd.t === 'multi') {
      if (Array.isArray(raw)) return raw;
      var parts = String(raw).split(/[;|]/).map(function (x) { return x.trim(); }).filter(Boolean);
      return parts.length ? parts : null;
    }
    if (fd && fd.t === 'select' && fd.opts) {
      var str = String(raw).trim();
      if (str === '') return null;
      var hit = fd.opts.filter(function (o) { return o.toLowerCase() === str.toLowerCase(); })[0];
      if (!hit) hit = fd.opts.filter(function (o) { return o.toLowerCase().indexOf(str.toLowerCase()) === 0; })[0];
      if (!hit) throw new Error('"' + raw + '" is not an option for ' + fd.l + '. Options: ' + fd.opts.join(' | '));
      return hit;
    }
    var v = String(raw);
    return v.trim() === '' ? null : v;
  }

  function setField(p, key, raw, who) {
    var fd = FIELDS[key];
    if (!fd) throw new Error('Unknown field "' + key + '". Use the fields command to list them.');
    var v = parseValue(fd, raw);
    if (v === null) delete p.fields[key]; else p.fields[key] = v;
    if (v !== null && p.unknown) delete p.unknown[key];
    addLog(p, 'Set ' + key + ' = ' + (Array.isArray(v) ? v.join('; ') : v), who);
    return v;
  }

  function setUnknown(p, key, note, who) {
    if (!FIELDS[key]) throw new Error('Unknown field "' + key + '".');
    p.unknown = p.unknown || {};
    p.unknown[key] = note || 'Unknown';
    delete p.fields[key];
    addLog(p, 'Marked ' + key + ' unknown: ' + (note || ''), who);
  }

  function answered(p, key) {
    var v = p.fields[key];
    var fd = FIELDS[key];
    if (fd && fd.t === 'bool') return v === true || !!(p.unknown && p.unknown[key]);
    return !empty(v) || !!(p.unknown && p.unknown[key]);
  }

  // ---------------------------------------------------------------------------
  // Stage progress and gating
  // ---------------------------------------------------------------------------
  function stageProgress(p, n) {
    var s = STAGES[n], req = [], missing = [], filled = 0, total = 0;
    s.groups.forEach(function (g) {
      g.fields.forEach(function (fd) {
        total++;
        if (answered(p, fd.k)) filled++;
        if (fd.req) { req.push(fd.k); if (!answered(p, fd.k)) missing.push(fd.k); }
      });
    });
    var extra = [];
    if (n === 2) {
      p.data_request.forEach(function (d) {
        if (['Received', 'Partial', 'Fallback used', 'Not needed'].indexOf(d.status) < 0) extra.push(d.id + ' ' + d.item + ' (' + d.status + ')');
      });
    }
    if (n === 3) {
      p.exercises.forEach(function (e) { if (e.status !== 'Done' && e.status !== 'Not applicable') extra.push(e.id + ' ' + exTitle(e.id) + ' (' + e.status + ')'); });
      p.review.forEach(function (r) { if (r.status !== 'Approved') extra.push('Review: ' + r.role + ' (' + r.status + ')'); });
    }
    var dl = s.deliverables.map(function (d) {
      return { id: d.id, title: d.title, by: d.by, done: (p.deliverables || []).some(function (x) { return x.id === d.id; }) };
    });
    var reqDone = req.length - missing.length;
    var pct = Math.round(100 * (reqDone + (dl.filter(function (d) { return d.done; }).length)) / Math.max(1, req.length + dl.length));
    if (n === 2) pct = Math.round(100 * (reqDone + p.data_request.length - extra.length) / Math.max(1, req.length + p.data_request.length));
    if (n === 3) {
      var tot = p.exercises.length + p.review.length;
      pct = Math.round(100 * (tot - extra.length) / tot);
    }
    var dlMissing = dl.filter(function (d) { return !d.done; });
    return { n: n, required: req.length, missing: missing, extra: extra, deliverables: dl, filled: filled, total: total, pct: pct,
      ready: missing.length === 0 && extra.length === 0 && dlMissing.length === 0 };
  }
  function exTitle(id) { var e = EXERCISES.filter(function (x) { return x.id === id; })[0]; return e ? e.title : id; }

  function setStage(p, n, action, reason, who) {
    var st = p.stages[n];
    if (!st) throw new Error('No stage ' + n);
    var t = nowIso();
    if (action === 'start') {
      for (var i = 0; i < n; i++) {
        if (p.stages[i].status !== 'complete' && p.stages[i].status !== 'skipped')
          throw new Error('Stage ' + i + ' is not complete or skipped. Complete it, or skip it only if the user asks to.');
      }
      st.status = 'in_progress'; st.started = st.started || t; p.current_stage = n;
    } else if (action === 'complete') {
      var pr = stageProgress(p, n);
      if (!pr.ready && !reason) throw new Error('Stage ' + n + ' is not ready. Open: ' + pr.missing.concat(pr.extra).concat(pr.deliverables.filter(function (d) { return !d.done; }).map(function (d) { return 'deliverable ' + d.id; })).join(', ') + '. Pass a reason to complete it anyway.');
      st.status = 'complete'; st.completed = t; st.skip_reason = reason || null;
      if (n + 1 < STAGES.length && p.stages[n + 1].status === 'not_started') { p.stages[n + 1].status = 'in_progress'; p.stages[n + 1].started = t; }
      p.current_stage = Math.min(n + 1, STAGES.length - 1);
    } else if (action === 'skip') {
      if (!reason) throw new Error('A skip needs the user\'s reason.');
      st.status = 'skipped'; st.skip_reason = reason; st.completed = t;
      if (n + 1 < STAGES.length && p.stages[n + 1].status === 'not_started') { p.stages[n + 1].status = 'in_progress'; p.stages[n + 1].started = t; }
      p.current_stage = Math.min(n + 1, STAGES.length - 1);
    } else if (action === 'reopen') {
      st.status = 'in_progress'; st.completed = null; p.current_stage = n;
    } else throw new Error('Unknown stage action ' + action);
    addLog(p, 'Stage ' + n + ' ' + action + (reason ? ' (' + reason + ')' : ''), who);
  }

  function addDeliverable(p, d, who) {
    p.deliverables = (p.deliverables || []).filter(function (x) { return x.id !== d.id; });
    p.deliverables.push({ id: d.id, stage: d.stage, title: d.title, markdown: d.markdown, updated: nowIso() });
    addLog(p, 'Saved deliverable ' + d.id + ' ' + d.title, who);
  }

  // ---------------------------------------------------------------------------
  // Load data import
  // ---------------------------------------------------------------------------
  function splitCsvLine(line, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === d) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }
  function detectDelimiter(lines) {
    var best = ',', bestScore = -1;
    [',', ';', '\t', '|'].forEach(function (d) {
      var counts = lines.slice(0, 20).map(function (l) { return l.split(d).length - 1; });
      var min = Math.min.apply(null, counts);
      if (min > bestScore) { bestScore = min; best = d; }
    });
    return best;
  }
  var DT_ISO = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;
  var DT_DMY = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i;
  var TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;

  function parseDateTime(s, order) {
    s = String(s || '').trim().replace(/^"|"$/g, '');
    var m = DT_ISO.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = DT_DMY.exec(s);
    if (m) {
      var a = +m[1], b = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      var day = order === 'mdy' ? b : a, mon = order === 'mdy' ? a : b;
      var h = +(m[4] || 0);
      if (m[7]) { var pm = m[7].toUpperCase() === 'PM'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
      if (mon < 1 || mon > 12 || day < 1 || day > 31) return NaN;
      return Date.UTC(y, mon - 1, day, h, +(m[5] || 0), +(m[6] || 0));
    }
    return NaN;
  }
  function parseTimeOfDay(s) {
    var m = TIME_ONLY.exec(String(s || '').trim());
    if (!m) return NaN;
    var h = +m[1];
    if (m[4]) { var pm = m[4].toUpperCase() === 'PM'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
    return ((h * 60 + +m[2]) * 60 + +(m[3] || 0)) * 1000;
  }
  function parseNumber(s, delim) {
    s = String(s === undefined ? '' : s).trim().replace(/^"|"$/g, '').replace(/\s/g, '');
    if (s === '' || s === '-' || /^(na|n\/a|null|nan)$/i.test(s)) return NaN;
    if (delim !== ',' && /^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  /*
   * Parse a CSV of interval readings into points [{t, v}] (t = ms, naive local time
   * stored as UTC). Options: dateOrder 'dmy'|'mdy'|'auto', unit 'auto'|'kW'|'MW'|'kWh',
   * valueColumn (index or header name).
   */
  function parseLoadCsv(text, opts) {
    opts = opts || {};
    var lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 3) throw new Error('The file has fewer than 3 lines.');
    var d = detectDelimiter(lines);
    var rows = lines.map(function (l) { return splitCsvLine(l, d); });
    // header: first row whose first cell is not a date
    var header = null, startRow = 0;
    for (var r = 0; r < Math.min(rows.length, 10); r++) {
      var c0 = rows[r][0];
      if (isNaN(parseDateTime(c0, 'dmy')) && isNaN(parseDateTime(c0, 'mdy'))) { header = rows[r]; startRow = r + 1; }
      else break;
    }
    var data = rows.slice(startRow);
    if (!data.length) throw new Error('No data rows found.');
    // date order
    var order = opts.dateOrder && opts.dateOrder !== 'auto' ? opts.dateOrder : null;
    if (!order) {
      order = 'dmy';
      for (var i = 0; i < Math.min(data.length, 2000); i++) {
        var m = DT_DMY.exec(String(data[i][0]).trim());
        if (m) { if (+m[1] > 12) { order = 'dmy'; break; } if (+m[2] > 12) { order = 'mdy'; break; } }
      }
    }
    // date + separate time column?
    var timeCol = -1;
    var t0 = parseDateTime(data[0][0], order);
    if (isNaN(t0)) throw new Error('Could not read a date in the first column: "' + data[0][0] + '". Put the timestamp in the first column.');
    if (data[0].length > 2 && !isNaN(parseTimeOfDay(data[0][1]))) timeCol = 1;
    // value column
    var vcol = -1;
    if (opts.valueColumn !== undefined && opts.valueColumn !== null && opts.valueColumn !== '') {
      if (isNum(+opts.valueColumn) && String(opts.valueColumn).trim() !== '') vcol = +opts.valueColumn;
      else if (header) vcol = header.findIndex(function (h) { return h.toLowerCase() === String(opts.valueColumn).toLowerCase(); });
      if (vcol < 0) throw new Error('Value column "' + opts.valueColumn + '" not found.');
    } else {
      var first = timeCol >= 0 ? 2 : 1;
      for (var c = first; c < data[0].length; c++) {
        var ok = 0, tot = 0;
        for (var k = 0; k < Math.min(data.length, 200); k++) { tot++; if (!isNaN(parseNumber(data[k][c], d))) ok++; }
        if (ok / tot > 0.8) { vcol = c; break; }
      }
      if (vcol < 0) throw new Error('No numeric value column found.');
    }
    // unit
    var unit = opts.unit && opts.unit !== 'auto' ? opts.unit : null;
    var hname = header && header[vcol] ? header[vcol].toLowerCase() : '';
    if (!unit) {
      if (/kwh/.test(hname)) unit = 'kWh';
      else if (/mwh/.test(hname)) unit = 'MWh';
      else if (/\bmw\b|\(mw\)|_mw|mw$/.test(hname)) unit = 'MW';
      else unit = 'kW';
    }
    var pts = [], bad = 0;
    for (var j = 0; j < data.length; j++) {
      var row = data[j];
      var t = parseDateTime(row[0], order);
      if (timeCol >= 0) t += parseTimeOfDay(row[1]);
      var v = parseNumber(row[vcol], d);
      if (isNaN(t) || isNaN(v)) { bad++; continue; }
      pts.push({ t: t, v: v });
    }
    if (pts.length < 3) throw new Error('Fewer than 3 readable rows.');
    pts.sort(function (a, b) { return a.t - b.t; });
    // interval
    var diffs = [];
    for (var q = 1; q < Math.min(pts.length, 5000); q++) { var df = (pts[q].t - pts[q - 1].t) / 60000; if (df > 0) diffs.push(df); }
    diffs.sort(function (a, b) { return a - b; });
    var med = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 60;
    var interval = [1, 5, 10, 15, 30, 60, 1440].reduce(function (best, x) { return Math.abs(x - med) < Math.abs(best - med) ? x : best; }, 60);
    // to kW
    var toKw;
    if (unit === 'MW') toKw = function (x) { return x * 1000; };
    else if (unit === 'kWh') toKw = function (x) { return x * 60 / interval; };
    else if (unit === 'MWh') toKw = function (x) { return x * 1000 * 60 / interval; };
    else toKw = function (x) { return x; };
    // Shift interval-ending timestamps? Keep as given; most meters stamp the end. Note only.
    var points = pts.map(function (p) { return { t: p.t, kw: toKw(p.v) }; });
    return { points: points, interval_min: interval, unit: unit, dateOrder: order, delimiter: d, header: header, valueColumn: vcol,
      valueName: header ? header[vcol] : 'column ' + (vcol + 1), rows: data.length, skipped: bad };
  }

  function seriesPoints(load) {
    if (!load || !load.kw) return [];
    var t0 = Date.parse(load.start + 'Z'), step = load.interval_min * 60000, out = [];
    for (var i = 0; i < load.kw.length; i++) if (load.kw[i] !== null) out.push({ t: t0 + i * step, kw: load.kw[i] });
    return out;
  }

  // Merge new points into the project's series and resample to a uniform grid.
  function importLoad(p, parsed, fileLabel, opts) {
    opts = opts || {};
    var interval = Math.max(15, parsed.interval_min);
    if (parsed.interval_min >= 1440) throw new Error('Daily data is too coarse for load analysis. Use the monthly bills table instead, or get 15 to 60 minute data.');
    var existing = opts.replace ? [] : seriesPoints(p.load);
    if (existing.length && p.load.interval_min !== interval) interval = Math.max(interval, p.load.interval_min);
    var all = existing.concat(parsed.points);
    var step = interval * 60000;
    var tmin = Infinity, tmax = -Infinity;
    all.forEach(function (x) { if (x.t < tmin) tmin = x.t; if (x.t > tmax) tmax = x.t; });
    tmin = Math.floor(tmin / step) * step;
    var n = Math.floor((tmax - tmin) / step) + 1;
    if (n > 3 * 366 * 24 * 60 / interval) throw new Error('More than 3 years of data. Import 12 to 24 months.');
    var sum = new Float64Array(n), cnt = new Uint16Array(n);
    // new points override existing ones in the same bucket
    var newSet = {};
    parsed.points.forEach(function (x) { newSet[Math.floor((x.t - tmin) / step)] = 1; });
    existing.forEach(function (x) { var i = Math.floor((x.t - tmin) / step); if (!newSet[i]) { sum[i] += x.kw; cnt[i]++; } });
    parsed.points.forEach(function (x) { var i = Math.floor((x.t - tmin) / step); sum[i] += x.kw; cnt[i]++; });
    var kw = new Array(n);
    for (var i = 0; i < n; i++) kw[i] = cnt[i] ? Math.round(sum[i] / cnt[i] * 10) / 10 : null;
    var sources = (opts.replace || !p.load ? [] : (p.load.sources || [])).concat([{ file: fileLabel || 'upload', rows: parsed.rows, skipped: parsed.skipped, unit: parsed.unit,
      interval_min: parsed.interval_min, column: parsed.valueName, date_order: parsed.dateOrder, imported: nowIso() }]);
    p.load = { start: new Date(tmin).toISOString().slice(0, 16), interval_min: interval, kw: kw, sources: sources };
    addLog(p, 'Imported load data from ' + (fileLabel || 'upload') + ' (' + parsed.points.length + ' rows, ' + parsed.unit + ', ' + parsed.interval_min + ' min)', opts.who);
    return p.load;
  }

  // Monthly bills: [{month:'2025-01', kwh, max_kw, cost}]
  function parseBillsCsv(text) {
    var lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
    var d = detectDelimiter(lines);
    var head = splitCsvLine(lines[0], d).map(function (h) { return h.toLowerCase(); });
    var col = function (re) { return head.findIndex(function (h) { return re.test(h); }); };
    var cm = col(/month|period|date/), ck = col(/kwh|energy|consumption/), cx = col(/max|demand|kw\b|md/), cc = col(/cost|amount|bill|total/);
    if (cm < 0 || ck < 0) throw new Error('Bills CSV needs a month column and a kWh column. Header found: ' + head.join(', '));
    var out = [];
    lines.slice(1).forEach(function (l) {
      var r = splitCsvLine(l, d), ms = r[cm];
      var m = /^(\d{4})[-\/.](\d{1,2})/.exec(ms) || /^(\d{1,2})[-\/.](\d{4})/.exec(ms);
      var month;
      if (m && m[1].length === 4) month = m[1] + '-' + ('0' + m[2]).slice(-2);
      else if (m) month = m[2] + '-' + ('0' + m[1]).slice(-2);
      else { var t = Date.parse(ms + ' 1'); if (!isNaN(t)) { var dt = new Date(t); month = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2); } }
      if (!month) return;
      out.push({ month: month, kwh: parseNumber(r[ck], d), max_kw: cx >= 0 ? parseNumber(r[cx], d) : null, cost: cc >= 0 ? parseNumber(r[cc], d) : null });
    });
    out.forEach(function (b) { ['kwh', 'max_kw', 'cost'].forEach(function (k) { if (!isNum(b[k])) b[k] = null; }); });
    return out;
  }

  // ---------------------------------------------------------------------------
  // E2 Load statistics
  // ---------------------------------------------------------------------------
  function loadStats(load) {
    if (!load || !load.kw || !load.kw.length) return null;
    var t0 = Date.parse(load.start + 'Z'), step = load.interval_min * 60000, dt = load.interval_min / 60;
    var vals = [], sum = 0, n = load.kw.length, peak = -Infinity, peakT = null, min = Infinity, minT = null;
    var months = {}, wk = [], we = [], wkN = [], weN = [], heat = [], heatN = [], days = {};
    for (var h = 0; h < 24; h++) { wk[h] = 0; we[h] = 0; wkN[h] = 0; weN[h] = 0; }
    for (var mo = 0; mo < 12; mo++) { heat[mo] = []; heatN[mo] = []; for (h = 0; h < 24; h++) { heat[mo][h] = 0; heatN[mo][h] = 0; } }
    for (var i = 0; i < n; i++) {
      var kw = load.kw[i];
      if (kw === null || kw === undefined) continue;
      var mw = kw / 1000, t = t0 + i * step, d = new Date(t);
      vals.push(mw); sum += mw;
      if (mw > peak) { peak = mw; peakT = t; }
      if (mw < min) { min = mw; minT = t; }
      var hr = d.getUTCHours(), dow = d.getUTCDay(), m = d.getUTCMonth();
      var key = d.getUTCFullYear() + '-' + ('0' + (m + 1)).slice(-2);
      var M = months[key] || (months[key] = { month: key, mwh: 0, max: -Infinity, min: Infinity, sum: 0, n: 0 });
      M.mwh += mw * dt; M.sum += mw; M.n++; if (mw > M.max) M.max = mw; if (mw < M.min) M.min = mw;
      if (dow === 0 || dow === 6) { we[hr] += mw; weN[hr]++; } else { wk[hr] += mw; wkN[hr]++; }
      heat[m][hr] += mw; heatN[m][hr]++;
      var dk = d.toISOString().slice(0, 10);
      var D = days[dk] || (days[dk] = { date: dk, min: Infinity, max: -Infinity, sum: 0, n: 0 });
      D.sum += mw; D.n++; if (mw < D.min) D.min = mw; if (mw > D.max) D.max = mw;
    }
    if (!vals.length) return null;
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var mean = sum / vals.length;
    var hoursCovered = vals.length * dt, spanHours = n * dt;
    var ldc = [];
    for (var k = 0; k <= 100; k++) ldc.push(percentileSorted(sorted, 1 - k / 100));
    var monthly = Object.keys(months).sort().map(function (key) { var M = months[key]; return { month: key, mwh: M.mwh, max: M.max, min: M.min, mean: M.sum / M.n, coverage: M.n }; });
    var daily = Object.keys(days).sort().map(function (key) { var D = days[key]; return { date: key, min: D.min, max: D.max, mean: D.sum / D.n }; });
    return {
      start: load.start, end: new Date(t0 + (n - 1) * step).toISOString().slice(0, 16), interval_min: load.interval_min,
      points: vals.length, slots: n, coverage: vals.length / n, days: spanHours / 24, hours_covered: hoursCovered,
      peak: peak, peak_time: new Date(peakT).toISOString().slice(0, 16), min_abs: min, min_time: new Date(minT).toISOString().slice(0, 16),
      p01: percentileSorted(sorted, 0.01), p05: percentileSorted(sorted, 0.05), p10: percentileSorted(sorted, 0.10), p50: percentileSorted(sorted, 0.5), p95: percentileSorted(sorted, 0.95),
      mean: mean, load_factor: mean / peak, energy_mwh: sum * dt, annual_mwh: mean * 8760,
      ldc: ldc, monthly: monthly, daily: daily,
      profile_weekday: wk.map(function (x, i) { return wkN[i] ? x / wkN[i] : null; }),
      profile_weekend: we.map(function (x, i) { return weN[i] ? x / weN[i] : null; }),
      heat: heat.map(function (row, m) { return row.map(function (x, h) { return heatN[m][h] ? x / heatN[m][h] : null; }); }),
      short_record: spanHours < 24 * 330
    };
  }

  function billsStats(bills) {
    var b = (bills || []).filter(function (x) { return isNum(x.kwh); });
    if (!b.length) return null;
    var kwh = b.reduce(function (s, x) { return s + x.kwh; }, 0);
    var maxes = b.map(function (x) { return x.max_kw; }).filter(isNum);
    var annual = kwh / 1000 * 12 / b.length;
    var peak = maxes.length ? Math.max.apply(null, maxes) / 1000 : null;
    var cost = b.map(function (x) { return x.cost; }).filter(isNum);
    return { months: b.length, annual_mwh: annual, peak: peak, mean: annual / 8760, load_factor: peak ? annual / 8760 / peak : null,
      avg_cost_per_mwh: cost.length === b.length ? cost.reduce(function (s, x) { return s + x; }, 0) / (kwh / 1000) : null };
  }

  // ---------------------------------------------------------------------------
  // Inputs: calc.* field > project data > load data > default
  // ---------------------------------------------------------------------------
  function resolveInputs(p, ls) {
    var F = p.fields, v = {}, src = {};
    ls = ls === undefined ? loadStats(p.load) : ls;
    var bs = billsStats(p.bills);
    Object.keys(CALC_DEFAULTS).forEach(function (k) {
      var own = F['calc.' + k];
      if (!empty(own)) { v[k] = own; src[k] = 'input'; return; }
      var from = CALC_SOURCES[k];
      if (from && !empty(F[from])) { v[k] = F[from]; src[k] = 'project:' + from; return; }
      v[k] = CALC_DEFAULTS[k]; src[k] = 'default';
    });
    // derived values
    if (src.peak !== 'input') {
      if (ls) { v.peak = ls.peak; src.peak = 'load data (maximum)'; }
      else if (bs && bs.peak) { v.peak = bs.peak; src.peak = 'bills (maximum demand)'; }
      else if (isNum(F['bills.max_kw'])) { v.peak = F['bills.max_kw'] / 1000; src.peak = 'project:bills.max_kw'; }
      else if (isNum(F['ops.peak_load_mw'])) { v.peak = F['ops.peak_load_mw']; src.peak = 'project:ops.peak_load_mw'; }
    }
    if (src.minload !== 'input') {
      // 5th percentile = minimum during normal operation. The lowest 5% of hours (shutdowns,
      // holidays) are hours when the engines simply stop; dispatch counts them as low-load hours.
      if (ls && !ls.short_record) { v.minload = ls.p05; src.minload = 'load data (5th percentile)'; }
      else if (isNum(F['ops.min_load_mw'])) { v.minload = F['ops.min_load_mw']; src.minload = 'project:ops.min_load_mw'; }
      else if (ls) { v.minload = ls.p05; src.minload = 'load data (5th percentile, short record)'; }
    }
    if (src.ifault !== 'input') {
      var est = existingFault(p, v);
      if (est) { v.ifault = est.ka; src.ifault = est.src; }
    }
    if (F['obj.export'] === 'Export allowed') v.export_allowed = true;
    v.demand_charge = isNum(F['tariff.demand_charge']) ? F['tariff.demand_charge'] : 0;
    v.heat_on = F['heat.enabled'] === 'Yes';
    v.heat_demand_mw = isNum(F['heat.demand_mw']) ? F['heat.demand_mw'] : 0;
    v.heat_hours = isNum(F['heat.hours']) ? F['heat.hours'] : 0;
    v.currency = F['meta.currency'] || '';
    return { v: v, src: src };
  }

  function existingFault(p, v) {
    var F = p.fields;
    if (isNum(F['elec.existing_fault_ka'])) return { ka: F['elec.existing_fault_ka'], src: 'project:elec.existing_fault_ka' };
    if (isNum(F['elec.tx_mva']) && isNum(F['elec.tx_z_pct']) && isNum(v.vconn) && v.vconn > 0) {
      var zg = isNum(F['elec.grid_fault_mva']) && F['elec.grid_fault_mva'] > 0 ? F['elec.tx_mva'] / F['elec.grid_fault_mva'] : 0;
      var count = isNum(F['elec.tx_count']) && F['elec.tx_count'] > 0 ? F['elec.tx_count'] : 1;
      var iu = count * F['elec.tx_mva'] / (SQRT3 * v.vconn * (F['elec.tx_z_pct'] / 100 + zg));
      var motor = isNum(v.motor_ka) ? v.motor_ka : 0;
      return { ka: iu + motor, utility_ka: iu, motor_ka: motor, src: 'estimated from transformer' + (zg ? ' and grid fault level' : ' (grid ignored, worst case)') + (motor ? ' + motors' : '') };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // E3 Tariff
  // ---------------------------------------------------------------------------
  function hourInRange(h, from, to) { return from <= to ? (h >= from && h < to) : (h >= from || h < to); }
  // rate table [dayType 0=weekday 1=weekend][hour]
  function rateTable(p, base) {
    var t = [[], []];
    for (var d = 0; d < 2; d++) for (var h = 0; h < 24; h++) t[d][h] = base;
    (p.tariff_periods || []).forEach(function (per) {
      if (!isNum(per.rate)) return;
      var from = isNum(per.from) ? per.from : 0, to = isNum(per.to) ? per.to : 24;
      for (var d2 = 0; d2 < 2; d2++) {
        if (per.days === 'weekday' && d2 === 1) continue;
        if (per.days === 'weekend' && d2 === 0) continue;
        for (var h2 = 0; h2 < 24; h2++) if (hourInRange(h2, from, to === 24 ? 24 : to)) t[d2][h2] = per.rate;
      }
    });
    return t;
  }
  function parseHours(s) {
    var m = /^\s*(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*$/.exec(String(s || ''));
    if (!m) return { from: 0, to: 24 };
    return { from: Math.min(24, +m[1]), to: Math.min(24, +m[2]) };
  }
  function runMask(v, rt, genCost) {
    var mask = [[], []], hrs = parseHours(v.run_hours);
    for (var d = 0; d < 2; d++) for (var h = 0; h < 24; h++) {
      var on;
      if (v.run_mode === 'always') on = true;
      else if (v.run_mode === 'hours') on = (hrs.from === 0 && hrs.to === 24) || (hrs.from === hrs.to) ? true : hourInRange(h, hrs.from, hrs.to);
      else on = rt[d][h] > genCost;
      if (v.run_days === 'weekdays' && d === 1) on = false;
      mask[d][h] = on;
    }
    return mask;
  }
  function tariffAnalysis(p, v, ls) {
    var rt = rateTable(p, v.tariff);
    // load-weighted average energy rate
    var wsum = 0, w = 0;
    if (ls) {
      for (var h = 0; h < 24; h++) {
        if (ls.profile_weekday[h] !== null) { wsum += rt[0][h] * ls.profile_weekday[h] * 5; w += ls.profile_weekday[h] * 5; }
        if (ls.profile_weekend[h] !== null) { wsum += rt[1][h] * ls.profile_weekend[h] * 2; w += ls.profile_weekend[h] * 2; }
      }
    }
    var simple = 0; for (var d = 0; d < 2; d++) for (var h2 = 0; h2 < 24; h2++) simple += rt[d][h2] * (d ? 2 : 5);
    simple /= 168;
    // blended = energy rate + demand charge spread over the energy: charge per kW-month × peak kW × 12 ÷ annual MWh
    var blended = null;
    if (ls && v.demand_charge) blended = (w ? wsum / w : simple) + v.demand_charge * ls.peak * 1000 * 12 / (ls.mean * 8760);
    return { table: rt, avg_simple: simple, avg_load_weighted: w ? wsum / w : null, blended: blended, has_tou: (p.tariff_periods || []).length > 0 };
  }

  // ---------------------------------------------------------------------------
  // E4 Sizing (playbook calculator) + dispatch against load data
  // ---------------------------------------------------------------------------
  function derate(v) {
    var auto = Math.max(0, v.alt - 500) / 100 + Math.max(0, v.ambient - 30) + Math.max(0, 70 - v.mn) * 0.5;
    var isOverride = isNum(v.override);
    return { pct: isOverride ? v.override : Math.min(auto, 60), auto: auto, override: isOverride };
  }

  function sizeOption(v, c, der) {
    var ps = c.mw * (1 - der / 100);
    var nBase = Math.max(1, Math.ceil(v.target / ps - 1e-9));
    var nTot = nBase + (v.red === 'N+1' ? 1 : 0);
    var installed = nTot * ps, duty = nBase * ps;
    var floor = ps * c.min / 100;
    var exportOk = floor <= v.minload;
    var sMVA = c.mw / v.pf;
    var step = Math.abs(c.kv - v.vconn) > 0.01;
    var X = v.xd / 100 + (step ? v.zt / 100 : 0);
    var iUnit = sMVA / (SQRT3 * v.vconn * X);
    var iGen = nTot * iUnit, iTot = v.ifault + iGen;
    var faultOk = iTot <= v.rating;
    var avail = pAtLeast(nTot, nBase, v.avail / 100);
    var availOk = avail * 100 >= v.req;
    var eff = c.eff / 100;
    var genCost = v.gas * MMBTU_PER_MWH * LHV_TO_HHV / eff + c.om;
    return {
      id: nTot + 'x' + c.mw, label: nTot + ' × ' + fmt(c.mw, c.mw % 1 ? 1 : 0) + ' MW' + (v.red === 'N+1' ? ' (N+1)' : ''),
      c: c, ps: ps, nBase: nBase, nTot: nTot, installed: installed, duty: duty, floor: floor, exportOk: exportOk || !!v.export_allowed,
      floorOk: exportOk, step: step, iUnit: iUnit, iGen: iGen, iTot: iTot, faultOk: faultOk, avail: avail, availOk: availOk,
      eff: eff, genCost: genCost, fuelMW: v.target / eff, nm3h: v.target / eff * 1000 / v.lhv,
      dutyShare: expectedDutyShare(nTot, nBase, v.avail / 100)
    };
  }

  function dispatch(p, v, opt, rt) {
    var load = p.load, cap = opt.duty, floor = opt.floor, margin = v.import_margin_mw || 0;
    var mask = runMask(v, rt, opt.genCost);
    if (!load || !load.kw || !load.kw.length) {
      var mwh = v.target * 8760 * v.cf / 100;
      return { method: 'capacity factor (no load data)', genMWh: mwh, avoided: mwh * v.tariff, demandSaving: 0, cf: mwh / (cap * 8760),
        siteMWh: null, share: null, runHours: null, lowLoadHours: null, offWindowHours: null, fullHours: null, monthly: [] };
    }
    var t0 = Date.parse(load.start + 'Z'), step = load.interval_min * 60000, dt = load.interval_min / 60;
    var genE = 0, avoided = 0, siteE = 0, covered = 0, runH = 0, lowH = 0, offH = 0, fullH = 0;
    var mb = {}, ma = {};
    for (var i = 0; i < load.kw.length; i++) {
      var kw = load.kw[i];
      if (kw === null || kw === undefined) continue;
      var L = kw / 1000, d = new Date(t0 + i * step), dow = d.getUTCDay(), h = d.getUTCHours();
      var dtp = (dow === 0 || dow === 6) ? 1 : 0, key = d.getUTCFullYear() * 12 + d.getUTCMonth();
      covered += dt; siteE += L * dt;
      var g = 0;
      if (!mask[dtp][h]) offH += dt;
      else {
        var target = L - margin;
        if (target < floor) lowH += dt;
        else { g = Math.min(target, cap); runH += dt; if (g >= cap - 1e-9) fullH += dt; }
      }
      genE += g * dt; avoided += g * dt * rt[dtp][h];
      if (!(key in mb) || L > mb[key]) mb[key] = L;
      var imp = L - g;
      if (!(key in ma) || imp > ma[key]) ma[key] = imp;
    }
    var scale = covered > 0 ? 8760 / covered : 0;
    var share = opt.dutyShare;
    var months = Object.keys(mb);
    var dsum = 0;
    months.forEach(function (k) { dsum += Math.max(0, mb[k] - ma[k]); });
    var demandSaving = months.length ? dsum * 1000 * v.demand_charge * (v.demand_credit_pct / 100) * 12 / months.length : 0;
    var genMWh = genE * scale * share;
    return {
      method: 'dispatch against load data', genMWh: genMWh, avoided: avoided * scale * share, demandSaving: demandSaving * share,
      cf: genMWh / (opt.installed * 8760), cfDuty: genMWh / (cap * 8760), siteMWh: siteE * scale, share: genMWh / (siteE * scale),
      runHours: runH * scale, lowLoadHours: lowH * scale, offWindowHours: offH * scale, fullHours: fullH * scale,
      availFactor: share, scale: scale, mask: mask,
      peakCut: months.length ? dsum / months.length : 0
    };
  }

  // ---------------------------------------------------------------------------
  // E5 Electrical
  // ---------------------------------------------------------------------------
  function electrical(p, v, opt, src) {
    var F = p.fields;
    var making = isNum(F['elec.switchgear_making_ka']) ? F['elec.switchgear_making_ka'] : 2.5 * v.rating;
    var iTot = opt.iTot, peakKa = 2.5 * iTot;
    var est = existingFault(p, v);
    var genA = opt.installed / v.pf * 1000 / (SQRT3 * v.vconn);
    var sitePeakA = v.peak / 0.9 * 1000 / (SQRT3 * v.vconn);
    var checks = {};
    checks.C1 = { status: iTot <= v.rating && peakKa <= making ? 'Pass' : 'Fail',
      detail: 'Existing ' + fmt(v.ifault, 1) + ' kA (' + (src && src.ifault || '') + ') + engines ' + fmt(opt.iGen, 1) + ' kA = ' + fmt(iTot, 1) + ' kA against a ' + fmt(v.rating, 1) + ' kA rating (' + fmt(100 * iTot / v.rating, 0) + '%). Peak about ' + fmt(peakKa, 1) + ' kA against ' + fmt(making, 1) + ' kA making.' };
    var ratings = [];
    if (isNum(F['elec.incomer_rating_a'])) ratings.push(['incomer', F['elec.incomer_rating_a']]);
    if (isNum(F['elec.busbar_rating_a'])) ratings.push(['busbar', F['elec.busbar_rating_a']]);
    if (ratings.length) {
      var okC2 = ratings.every(function (r) { return Math.max(sitePeakA, genA) <= r[1]; });
      checks.C2 = { status: okC2 ? 'Pass' : 'Fail', detail: 'Worst case: site peak from the grid with the engines tripped is about ' + fmt(sitePeakA, 0) + ' A; engine output about ' + fmt(genA, 0) + ' A. Ratings: ' + ratings.map(function (r) { return r[0] + ' ' + fmt(r[1], 0) + ' A'; }).join(', ') + '.' };
    } else checks.C2 = { status: 'Needs data', detail: 'Enter the incomer and busbar ratings. Site peak from the grid is about ' + fmt(sitePeakA, 0) + ' A; engine output about ' + fmt(genA, 0) + ' A.' };
    var exportPotential = Math.max(0, opt.duty - v.minload);
    checks.C4 = { status: opt.floorOk ? 'Pass' : (v.export_allowed ? 'Pass' : 'Fail'),
      detail: 'Lowest stable output ' + fmt(opt.floor, 2) + ' MW vs site minimum ' + fmt(v.minload, 2) + ' MW. Without control, full output at minimum load would push ' + fmt(exportPotential, 2) + ' MW back through the transformer: fit 32R and a zero-export controller.' + (v.export_allowed ? ' Export is allowed for this project.' : '') };
    return { making: making, peakKa: peakKa, genA: genA, sitePeakA: sitePeakA, exportPotential: exportPotential, est: est, checks: checks };
  }

  // ---------------------------------------------------------------------------
  // E6, E7 Gas and heat
  // ---------------------------------------------------------------------------
  function gasHeat(p, v, opt, d) {
    var fuelMWh = d.genMWh / opt.eff;
    var gas = {
      fuel_mw_full: opt.duty / opt.eff, nm3h_full: opt.duty / opt.eff * 1000 / v.lhv,
      annual_nm3: fuelMWh * 1000 / v.lhv, annual_mmbtu: fuelMWh * MMBTU_PER_MWH * LHV_TO_HHV,
      options: (p.gas_options || []).map(function (g) {
        var price = isNum(g.price) ? g.price : (/pipeline/i.test(g.name) ? v.gas : null);
        if (!isNum(price)) return { name: g.name, price: null };
        var gc = price * MMBTU_PER_MWH * LHV_TO_HHV / opt.eff + opt.c.om;
        return { name: g.name, price: price, genCost: gc, spread: v.tariff - gc, annualCost: fuelMWh * MMBTU_PER_MWH * LHV_TO_HHV * price };
      })
    };
    var heat = { enabled: v.heat_on, avail_mw_full: opt.duty / opt.eff * v.heat_frac / 100, annual_avail_mwh: fuelMWh * v.heat_frac / 100,
      demand_mwh: v.heat_demand_mw * v.heat_hours, used_mwh: 0, credit: 0, boilerCostPerMWh: v.gas * MMBTU_PER_MWH * LHV_TO_HHV / (v.boiler_eff / 100) };
    if (v.heat_on) {
      heat.used_mwh = Math.min(heat.annual_avail_mwh, heat.demand_mwh);
      heat.credit = heat.used_mwh * heat.boilerCostPerMWh;
    }
    return { gas: gas, heat: heat };
  }

  // ---------------------------------------------------------------------------
  // E10, E11 Cost and business case
  // ---------------------------------------------------------------------------
  function capex(v, opt) {
    var engines = opt.nTot * opt.c.mw * 1000 * opt.c.cx;
    var lines = [
      { item: 'Engines installed (' + opt.nTot + ' × ' + opt.c.mw + ' MW at ' + fmt(opt.c.cx, 0) + ' per kW)', cost: engines },
      { item: 'Switchgear upgrade or reactors', cost: v.switchgear_upgrade || 0 },
      { item: 'Gas connection or gas station', cost: v.gas_connection || 0 },
      { item: 'Heat recovery equipment', cost: v.heat_on ? (v.heat_recovery || 0) : 0 },
      { item: 'Development, studies and permits', cost: v.development || 0 }
    ];
    var sub = lines.reduce(function (s, l) { return s + l.cost; }, 0);
    var cont = sub * (v.contingency_pct || 0) / 100;
    lines.push({ item: 'Contingency (' + fmt(v.contingency_pct, 0) + '%)', cost: cont });
    return { lines: lines, total: sub + cont, perKw: (sub + cont) / (opt.installed * 1000) };
  }

  function economics(v, opt, d, gh, m) {
    m = m || {};
    var mg = m.gas || 1, mt = m.tariff || 1, mc = m.capex || 1, me = m.energy || 1;
    var cx = capex(v, opt), capTotal = cx.total * mc;
    var gen = d.genMWh * me;
    var fuelPerMWh = v.gas * mg * MMBTU_PER_MWH * LHV_TO_HHV / opt.eff;
    var fuel = gen * fuelPerMWh, om = gen * opt.c.om;
    var avoided = d.avoided * me * mt, demand = d.demandSaving * mt;
    var heatCredit = gh.heat.credit * me * mg;
    var fixed = (v.staff_per_yr || 0) + capTotal * (v.insurance_pct || 0) / 100;
    var y1 = avoided + demand + heatCredit - fuel - om - fixed;
    var N = Math.max(1, Math.round(v.years)), flows = [-capTotal], cum = -capTotal, payback = null;
    var te = v.tariff_esc_pct / 100, ge = v.gas_esc_pct / 100, oe = v.om_esc_pct / 100;
    var rows = [];
    for (var y = 1; y <= N; y++) {
      var a = (avoided + demand) * Math.pow(1 + te, y - 1), fu = fuel * Math.pow(1 + ge, y - 1), hc = heatCredit * Math.pow(1 + ge, y - 1);
      var o = (om + fixed) * Math.pow(1 + oe, y - 1);
      var cf = a + hc - fu - o;
      flows.push(cf);
      var prev = cum; cum += cf;
      if (payback === null && cum >= 0 && cf > 0) payback = y - 1 + (-prev) / cf;
      rows.push({ year: y, savings: a, heat: hc, fuel: fu, om: o, net: cf, cumulative: cum });
    }
    var r = v.discount_pct / 100;
    var lcoe = gen > 0 ? (capTotal * crf(r, N) + fixed + fuel + om) / gen : null;
    var h = v.ppa_irr_pct / 100;
    var ppa = gen > 0 ? (capTotal * crf(h, N) + fixed + fuel + om - heatCredit) / gen : null;
    var avgAvoided = gen > 0 ? avoided / gen : null;
    return {
      capex: capTotal, capexLines: cx.lines, capexPerKw: cx.perKw * mc, genMWh: gen, fuel: fuel, om: om, fixed: fixed, avoided: avoided, demand: demand,
      heatCredit: heatCredit, year1: y1, simplePayback: y1 > 0 ? capTotal / y1 : null, payback: payback, npv: npv(r, flows), irr: irr(flows),
      lcoe: lcoe, genCostPerMWh: fuelPerMWh + opt.c.om, avgAvoidedPerMWh: avgAvoided, ppa: ppa,
      ppaClientSaving: ppa !== null ? avoided + demand - ppa * gen : null, flows: flows, rows: rows
    };
  }

  function sensitivities(v, opt, d, gh, p, rt) {
    var base = economics(v, opt, d, gh);
    var cases = [
      { name: 'Gas price', lo: '-20%', hi: '+20%', mlo: { gas: 0.8 }, mhi: { gas: 1.2 } },
      { name: 'Grid tariff', lo: '-15%', hi: '+15%', mlo: { tariff: 0.85 }, mhi: { tariff: 1.15 } },
      { name: 'Capex', lo: '-20%', hi: '+20%', mlo: { capex: 0.8 }, mhi: { capex: 1.2 } },
      { name: 'Utilization (energy)', lo: '-15%', hi: '+15%', mlo: { energy: 0.85 }, mhi: { energy: 1.15 } }
    ];
    var out = cases.map(function (c) {
      var a = economics(v, opt, d, gh, c.mlo), b = economics(v, opt, d, gh, c.mhi);
      return { name: c.name, lo: c.lo, hi: c.hi, npvLo: a.npv, npvHi: b.npv, pbLo: a.simplePayback, pbHi: b.simplePayback };
    });
    // availability ±5 points
    var av = [Math.max(50, v.avail - 5), Math.min(100, v.avail + 5)].map(function (a) {
      var share = expectedDutyShare(opt.nTot, opt.nBase, a / 100);
      var e = share / (opt.dutyShare || 1);
      return economics(v, opt, d, gh, { energy: e });
    });
    out.push({ name: 'Unit availability', lo: '-5 pts', hi: '+5 pts', npvLo: av[0].npv, npvHi: av[1].npv, pbLo: av[0].simplePayback, pbHi: av[1].simplePayback });
    return { base: base, cases: out };
  }

  // ---------------------------------------------------------------------------
  // Gates and auto assumptions
  // ---------------------------------------------------------------------------
  function gates(p, v, a) {
    var F = p.fields, best = a.best, g = [];
    var gasAvail = F['gas.availability'];
    var anyCheaper = a.options.some(function (o) { return o.genCost < (a.tariff.avg_load_weighted || v.tariff); });
    g.push({ id: 'G1', title: 'Gas is available at a price where generation is cheaper than the grid',
      status: !gasAvail || gasAvail === 'Unknown' ? 'Unknown' : (anyCheaper ? 'Pass' : 'Fail'),
      detail: 'Gas: ' + (gasAvail || 'not recorded') + '. Cheapest generation cost ' + fmt(Math.min.apply(null, a.options.map(function (o) { return o.genCost; })), 1) + ' vs average tariff ' + fmt(a.tariff.avg_load_weighted || v.tariff, 1) + ' per MWh.' });
    var anyTurn = a.options.some(function (o) { return o.exportOk; });
    g.push({ id: 'G2', title: 'The plant can turn down below the site minimum load (or export is allowed)',
      status: anyTurn ? 'Pass' : 'Fail', detail: 'Site minimum ' + fmt(v.minload, 2) + ' MW (' + (a.src.minload || '') + '). ' + a.options.filter(function (o) { return o.exportOk; }).length + ' of ' + a.options.length + ' options pass.' });
    var par = F['reg.parallel_allowed'];
    g.push({ id: 'G3', title: 'The utility permits parallel operation',
      status: par === 'Yes' || par === 'Yes, with conditions' ? 'Pass' : (par === 'No' ? 'Fail' : 'Unknown'), detail: 'Recorded answer: ' + (par || 'not recorded') + '.' });
    var anyFault = a.options.some(function (o) { return o.faultOk; });
    g.push({ id: 'G4', title: 'The switchboard can take the fault current, or fixing it is affordable',
      status: anyFault ? 'Pass' : (v.switchgear_upgrade > 0 ? 'Pass' : 'Fail'),
      detail: anyFault ? a.options.filter(function (o) { return o.faultOk; }).length + ' option(s) stay within the ' + fmt(v.rating, 1) + ' kA rating.' : (v.switchgear_upgrade > 0 ? 'All options exceed the rating; an upgrade is priced at ' + fmtMoney(v.switchgear_upgrade, v.currency) + '.' : 'All options exceed the rating and no upgrade is priced.') });
    return g;
  }

  var SRC_LABEL = {
    target: 'Output needed', red: 'Redundancy', pf: 'Power factor', peak: 'Site peak', minload: 'Site minimum load', ambient: 'Hot-day temperature', alt: 'Altitude',
    mn: 'Methane number', vconn: 'Connection voltage', ifault: 'Existing fault level', rating: 'Switchboard rating', xd: 'Generator X″d', zt: 'Step-up transformer impedance',
    lhv: 'Gas LHV', gas: 'Gas price', tariff: 'Grid tariff', cf: 'Capacity factor', avail: 'Unit availability', req: 'Required availability'
  };
  function autoAssumptions(p, a) {
    var out = [];
    Object.keys(SRC_LABEL).forEach(function (k) {
      if (k === 'cf' && p.load) return;
      if (a.src[k] === 'default') out.push({ item: SRC_LABEL[k], assumption: 'Planning default ' + a.v[k] + (k === 'red' ? '' : ''), source: 'Playbook default', risk: 'Replace with project data' });
      else if (/estimated/.test(a.src[k] || '')) out.push({ item: SRC_LABEL[k], assumption: fmt(a.v[k], 1), source: a.src[k], risk: 'Preliminary, subject to utility data' });
    });
    p.data_request.forEach(function (d) {
      if (d.status === 'Fallback used') out.push({ item: d.item, assumption: d.note || 'Fallback used', source: d.fallback, risk: 'Data request ' + d.id + ' not met' });
    });
    Object.keys(p.unknown || {}).forEach(function (k) {
      out.push({ item: FIELDS[k] ? FIELDS[k].l : k, assumption: 'Unknown: ' + p.unknown[k], source: FIELDS[k] && FIELDS[k].fb ? FIELDS[k].fb : 'Not available', risk: 'Confirm before the proposal' });
    });
    if (a.ls && a.ls.short_record) out.push({ item: 'Load data', assumption: 'Only ' + fmt(a.ls.days, 0) + ' days of interval data', source: 'Short record scaled to a year', risk: 'Seasonal variation not captured; show savings as a range' });
    if (a.ls && a.ls.coverage < 0.95) out.push({ item: 'Load data', assumption: fmt(100 * (1 - a.ls.coverage), 1) + '% of intervals missing', source: 'Gaps skipped and the rest scaled', risk: 'Check the gaps are not shutdowns' });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Full analysis
  // ---------------------------------------------------------------------------
  function analyse(p) {
    var ls = loadStats(p.load);
    var bs = billsStats(p.bills);
    var r = resolveInputs(p, ls), v = r.v;
    var der = derate(v);
    var classes = (p.engine_classes || []).filter(function (c) { return isNum(c.mw) && c.mw > 0 && isNum(c.eff) && c.eff > 0; });
    var tar = tariffAnalysis(p, v, ls);
    var rt = tar.table;
    var options = classes.map(function (c) {
      var o = sizeOption(v, c, der.pct);
      o.dispatch = dispatch(p, v, o, rt);
      o.elec = electrical(p, v, o, r.src);
      var gh = gasHeat(p, v, o, o.dispatch);
      o.gas = gh.gas; o.heat = gh.heat;
      var sens = sensitivities(v, o, o.dispatch, gh, p, rt);
      o.econ = sens.base; o.sens = sens.cases;
      o.pass = o.exportOk && o.faultOk && o.availOk;
      return o;
    });
    var ranked = options.slice().sort(function (a, b) {
      if (a.pass !== b.pass) return a.pass ? -1 : 1;
      var pa = a.econ.simplePayback === null ? Infinity : a.econ.simplePayback, pb = b.econ.simplePayback === null ? Infinity : b.econ.simplePayback;
      return pa - pb;
    });
    var best = ranked[0] && ranked[0].pass && ranked[0].econ.simplePayback !== null ? ranked[0] : null;
    var sel = (p.selected_options || []).map(function (id) { return options.filter(function (o) { return o.id === id; })[0]; }).filter(Boolean);
    if (!sel.length) sel = ranked.slice(0, 2);
    var a = { v: v, src: r.src, derate: der, ls: ls, bills: bs, tariff: tar, options: options, ranked: ranked, best: best, selected: sel };
    a.gates = gates(p, v, a);
    a.assumptions = autoAssumptions(p, a);
    a.suggested_size = ls ? { base_p05: ls.p05, p10: ls.p10, note: 'For zero export, keep the lowest stable output (one unit at minimum load) below the site minimum, and the duty capacity near the base load for high utilization.' } : null;
    return a;
  }

  // Compact snapshot stored in the project file by the CLI (dashboard recomputes live)
  function snapshot(a) {
    return {
      computed: nowIso(),
      inputs: a.v, sources: a.src, derate_pct: a.derate.pct,
      load: a.ls ? { start: a.ls.start, end: a.ls.end, coverage: a.ls.coverage, peak: a.ls.peak, min_abs: a.ls.min_abs, p01: a.ls.p01, p05: a.ls.p05, mean: a.ls.mean, load_factor: a.ls.load_factor, annual_mwh: a.ls.annual_mwh } : null,
      tariff: { avg_simple: a.tariff.avg_simple, avg_load_weighted: a.tariff.avg_load_weighted, blended: a.tariff.blended },
      options: a.ranked.map(function (o) {
        return { id: o.id, label: o.label, pass: o.pass, exportOk: o.exportOk, faultOk: o.faultOk, availOk: o.availOk, installed_mw: o.installed, duty_mw: o.duty,
          floor_mw: o.floor, fault_ka: o.iTot, availability: o.avail, gen_cost: o.genCost, gen_mwh: o.dispatch.genMWh, cf: o.dispatch.cf,
          capex: o.econ.capex, year1_saving: o.econ.year1, payback: o.econ.simplePayback, npv: o.econ.npv, irr: o.econ.irr, lcoe: o.econ.lcoe, ppa: o.econ.ppa };
      }),
      best: a.best ? a.best.id : null, gates: a.gates
    };
  }

  // ---------------------------------------------------------------------------
  // Markdown generators
  // ---------------------------------------------------------------------------
  function val(p, k, suffix) {
    var v = p.fields[k];
    if (empty(v)) return p.unknown && p.unknown[k] ? '_unknown (' + p.unknown[k] + ')_' : '_not yet known_';
    if (Array.isArray(v)) return v.join(', ');
    if (v === true) return 'yes';
    if (v === false) return 'no';
    return String(v) + (suffix ? ' ' + suffix : '');
  }
  function cur(p) { return p.fields['meta.currency'] || ''; }
  function mdTable(head, rows) {
    var esc = function (x) { return String(x === null || x === undefined ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' '); };
    return '| ' + head.map(esc).join(' | ') + ' |\n|' + head.map(function () { return '---'; }).join('|') + '|\n' +
      rows.map(function (r) { return '| ' + r.map(esc).join(' | ') + ' |'; }).join('\n') + '\n';
  }
  function title(p) { return p.fields['meta.project_name'] || p.fields['client.name'] || 'BTM gas engine project'; }

  function hypothesisMd(p, a) {
    a = a || analyse(p);
    var c = cur(p), v = a.v, lines = [];
    lines.push('# First hypothesis (ballpark): ' + title(p));
    lines.push('');
    lines.push('_Indication only, built before the discovery meeting from desk research and the bills. Not a promise of savings. Every number below changes once interval load data, the tariff contract and a gas quote arrive._');
    lines.push('');
    lines.push('## What it is based on');
    lines.push(mdTable(['Input', 'Value', 'Source'], [
      ['Site peak demand', fmt(v.peak, 2) + ' MW', a.src.peak],
      ['Site minimum demand', fmt(v.minload, 2) + ' MW', a.src.minload],
      ['Hot-day temperature, altitude', fmt(v.ambient, 0) + ' °C, ' + fmt(v.alt, 0) + ' m', a.src.ambient + ', ' + a.src.alt],
      ['Grid energy tariff', fmt(v.tariff, 1) + ' ' + c + '/MWh', a.src.tariff],
      ['Gas price', fmt(v.gas, 2) + ' ' + c + '/MMBtu', a.src.gas],
      ['Size asked for', fmt(v.target, 1) + ' MW', a.src.target]
    ]));
    lines.push('Applied derate: ' + fmt(a.derate.pct, 1) + '%.');
    lines.push('');
    lines.push('## Configurations');
    lines.push(mdTable(['Configuration', 'Checks', 'Generation cost /MWh', 'Annual saving', 'Capex', 'Payback (yr)'], a.ranked.map(function (o) {
      return [o.label, (o.exportOk ? 'turn-down ok' : 'turn-down FAIL') + ', ' + (o.faultOk ? 'fault ok' : 'fault FAIL') + ', ' + (o.availOk ? 'availability ok' : 'availability FAIL'),
        fmt(o.genCost, 1), fmtMoney(o.econ.year1, c), fmtMoney(o.econ.capex, c), o.econ.simplePayback ? fmt(o.econ.simplePayback, 1) : 'none'];
    })));
    var b = a.best || a.ranked[0];
    if (b) {
      var lo = b.sens.filter(function (s) { return s.name === 'Grid tariff'; })[0];
      lines.push('## Headline to take into the meeting');
      lines.push('- Indicative configuration: **' + b.label + '**, generation cost about **' + fmt(b.genCost, 0) + ' ' + c + '/MWh** against a grid tariff of about ' + fmt(a.tariff.avg_load_weighted || v.tariff, 0) + '.');
      lines.push('- Savings band (tariff ±15%): payback about ' + (lo && lo.pbHi ? fmt(lo.pbHi, 1) : '–') + ' to ' + (lo && lo.pbLo ? fmt(lo.pbLo, 1) : 'over the evaluation period') + ' years.');
      lines.push('- What would change this most: the minimum load (turn-down), the gas price and the switchboard rating.');
    }
    lines.push('');
    lines.push('## Defaults still in use');
    var asum = a.assumptions.filter(function (x) { return x.source === 'Playbook default'; });
    lines.push(asum.length ? asum.map(function (x) { return '- ' + x.item + ': ' + x.assumption; }).join('\n') : '- None');
    return lines.join('\n') + '\n';
  }

  function meetingPackMd(p) {
    var lines = [], F = p.fields;
    lines.push('# Discovery meeting pack: ' + title(p));
    lines.push('');
    lines.push('Client: ' + val(p, 'client.name') + ' · Site: ' + val(p, 'client.site_name') + ', ' + val(p, 'site.city') + ', ' + val(p, 'site.country') + ' · Date: ' + val(p, 'meeting.date'));
    lines.push('');
    lines.push('## Agenda (2 to 3 hours plus site walk)');
    lines.push(mdTable(['#', 'Agenda item', 'Time', 'Leave with'], [
      ['1', 'Introductions and purpose', '10 min', 'Agreement on what today is for'],
      ['2', 'Drivers and constraints', '30 min', 'Why, how it runs, export or not, gas source'],
      ['3', 'Operations', '20 min', 'Shifts, night and weekend load, critical loads, outages, power quality, growth'],
      ['4', 'SLD walk-through with their electrical engineer', '30 min', 'Tapping point, spare bays, transformer and switchgear data, bus tie'],
      ['5', 'Gas and thermal needs', '20 min', 'Gas availability and pressure; steam, hot water, chilled water'],
      ['6', 'Commercial and decision process', '20 min', 'Capex or PPA, hurdle, budget cycle, decision maker, timeline'],
      ['7', 'Site walk', '60 min', 'Photos and notes (checklist below)'],
      ['8', 'Agree next steps', '10 min', 'Data request with owners and dates; date for the proposal meeting']
    ]));
    lines.push('## What we already know');
    lines.push('- Industry: ' + val(p, 'client.industry') + '; shifts: ' + val(p, 'client.shifts'));
    lines.push('- Utility ' + val(p, 'utility.name') + ', tariff class ' + val(p, 'tariff.class') + ', energy rate ' + val(p, 'tariff.energy_rate', cur(p) + '/MWh'));
    lines.push('- Gas: ' + val(p, 'gas.availability') + ', price ' + val(p, 'gas.price_per_mmbtu', cur(p) + '/MMBtu'));
    lines.push('- Parallel operation allowed: ' + val(p, 'reg.parallel_allowed') + '; export: ' + val(p, 'reg.export_allowed'));
    lines.push('- Bills: maximum demand ' + val(p, 'bills.max_kw', 'kW') + ', annual ' + val(p, 'bills.annual_mwh', 'MWh'));
    lines.push('');
    lines.push('## Question sheet (unanswered items first)');
    var st = STAGES[1];
    st.groups.forEach(function (g) {
      if (/Site walk|Meeting$|Next steps/.test(g.title)) return;
      var qs = g.fields.filter(function (fd) { return fd.t !== 'bool'; }).sort(function (x, y) { return (answered(p, x.k) ? 1 : 0) - (answered(p, y.k) ? 1 : 0) || (y.req ? 1 : 0) - (x.req ? 1 : 0); });
      lines.push('### ' + g.title);
      qs.forEach(function (fd) {
        var have = answered(p, fd.k);
        lines.push('- [' + (have ? 'x' : ' ') + '] ' + fd.l + (fd.u ? ' (' + fd.u + ')' : '') + (have ? ': ' + val(p, fd.k) : '') + (fd.req ? ' **(must have)**' : ''));
      });
      lines.push('');
    });
    lines.push('### Key questions to ask');
    ['What is the lowest load the site ever runs at (nights, weekends, holidays)? This sets the zero-export limit.',
      'Are there large motors or other loads that cause dips or flicker when they start?',
      'Has the utility ever restricted or refused on-site generation in the area?',
      'Who maintains the switchgear and relays, and when was the last protection study?',
      'Is there space or land you are allowed to use? Are there neighbours sensitive to noise?',
      'What would make this project fail internally? For example payback longer than X years, or a ban on capex.'].forEach(function (q) { lines.push('- ' + q); });
    lines.push('');
    lines.push('## Site walk checklist');
    STAGES[1].groups.filter(function (g) { return g.title === 'Site walk checklist'; })[0].fields.forEach(function (fd) {
      if (fd.t === 'bool') lines.push('- [' + (F[fd.k] ? 'x' : ' ') + '] ' + fd.l);
    });
    lines.push('');
    lines.push('## Bring');
    ['Playbook one-page summary', '2 or 3 reference projects', 'Typical configurations (1×10, 2×5, 3×3.3, 4×2.5 MW)', 'Indicative generation cost per MWh (from the first hypothesis)', 'NDA if needed', 'Camera, torch, PPE'].forEach(function (x) { lines.push('- ' + x); });
    return lines.join('\n') + '\n';
  }

  function dataRequestMd(p) {
    var lines = [];
    lines.push('# Data request: ' + title(p));
    lines.push('');
    lines.push('Sent: ' + val(p, 's2.sent_date') + ' to ' + val(p, 's2.sent_to'));
    lines.push('');
    lines.push(mdTable(['ID', 'Item', 'Why we need it', 'Owner', 'Due', 'Status'], p.data_request.map(function (d) { return [d.id, d.item, d.why, d.owner, d.due, d.status + (d.received ? ' (' + d.received + ')' : '')]; })));
    lines.push('## If an item does not arrive');
    lines.push('We will not stop. We will use the fallback below, record it in the assumptions log and flag it in the proposal.');
    lines.push('');
    p.data_request.forEach(function (d) { lines.push('- **' + d.id + ' ' + d.item + ':** ' + d.fallback); });
    lines.push('');
    lines.push('## Email draft');
    lines.push('');
    lines.push('Subject: ' + title(p) + ': information needed for the proposal');
    lines.push('');
    lines.push('Dear ' + (p.fields['s2.sent_to'] || '[name]') + ',');
    lines.push('');
    lines.push('Thank you for the time at the meeting' + (p.fields['s1.meeting_date'] ? ' on ' + p.fields['s1.meeting_date'] : '') + '. To prepare the proposal we need the items in the table below. Each has an owner and a date, as agreed. If an item is hard to get, tell us and we will use an alternative so the work keeps moving.');
    lines.push('');
    p.data_request.filter(function (d) { return d.status !== 'Not needed' && !/OEM/.test(d.owner); }).forEach(function (d) { lines.push('- ' + d.item + ' (' + d.owner + ', by ' + d.due + ')'); });
    lines.push('');
    lines.push('Best regards,');
    lines.push(p.fields['team.tsm'] || '[name]');
    return lines.join('\n') + '\n';
  }

  function dataRequestCsv(p) {
    var esc = function (x) { x = String(x === null || x === undefined ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var rows = [['ID', 'Item', 'Why', 'Owner', 'Due', 'Status', 'Received', 'Note', 'Fallback']];
    p.data_request.forEach(function (d) { rows.push([d.id, d.item, d.why, d.owner, d.due, d.status, d.received, d.note, d.fallback]); });
    return rows.map(function (r) { return r.map(esc).join(','); }).join('\n') + '\n';
  }

  function resultsMd(p, a) {
    a = a || analyse(p);
    var c = cur(p), v = a.v, L = [];
    L.push('# Exercise results: ' + title(p));
    L.push('');
    L.push('_Computed ' + nowIso().slice(0, 16).replace('T', ' ') + ' UTC. Budgetary accuracy (about ±30%)._');
    L.push('');
    L.push('## Go/no-go gates');
    L.push(mdTable(['Gate', 'Status', 'Detail'], a.gates.map(function (g) { return [g.id + ' ' + g.title, g.status, g.detail]; })));
    L.push('## E2 Load profile');
    if (a.ls) {
      var s = a.ls;
      L.push(mdTable(['Measure', 'Value'], [
        ['Period', s.start.slice(0, 10) + ' to ' + s.end.slice(0, 10) + ' (' + fmt(s.days, 0) + ' days, ' + s.interval_min + ' min, ' + fmt(100 * s.coverage, 1) + '% coverage)'],
        ['Peak', fmt(s.peak, 2) + ' MW at ' + s.peak_time.replace('T', ' ')],
        ['Minimum (absolute)', fmt(s.min_abs, 2) + ' MW at ' + s.min_time.replace('T', ' ')],
        ['1st percentile', fmt(s.p01, 2) + ' MW'],
        ['Minimum during normal operation, used for sizing (5th percentile)', fmt(s.p05, 2) + ' MW'],
        ['10th percentile', fmt(s.p10, 2) + ' MW'],
        ['Average', fmt(s.mean, 2) + ' MW; load factor ' + fmt(100 * s.load_factor, 0) + '%'],
        ['Annual energy', fmt(s.annual_mwh, 0) + ' MWh/yr']
      ]));
      if (isNum(p.fields['ops.min_load_mw'])) L.push('Client said the minimum load is ' + fmt(p.fields['ops.min_load_mw'], 2) + ' MW; the data says ' + fmt(s.p05, 2) + ' MW.\n');
    } else if (a.bills) {
      L.push('No interval data. Bills (' + a.bills.months + ' months): ' + fmt(a.bills.annual_mwh, 0) + ' MWh/yr, peak ' + fmt(a.bills.peak, 2) + ' MW. Minimum load from the client: ' + val(p, 'ops.min_load_mw', 'MW') + '.\n');
    } else L.push('No load data yet.\n');
    L.push('## E3 Tariff');
    L.push('- Base energy rate ' + fmt(v.tariff, 1) + ' ' + c + '/MWh (' + a.src.tariff + ')' + (a.tariff.has_tou ? '; time-of-use bands applied' : ''));
    if (a.tariff.avg_load_weighted) L.push('- Load-weighted energy rate ' + fmt(a.tariff.avg_load_weighted, 1) + ' ' + c + '/MWh');
    if (a.tariff.blended) L.push('- Blended rate including demand charge ' + fmt(a.tariff.blended, 1) + ' ' + c + '/MWh');
    L.push('');
    L.push('## E4 Sizing and configuration');
    L.push('Derate ' + fmt(a.derate.pct, 1) + '% (' + (a.derate.override ? 'override' : 'planning rule') + '). Required ' + fmt(v.target, 1) + ' MW, ' + v.red + '.');
    L.push('');
    L.push(mdTable(['Option', 'Pass', 'Installed MW', 'Min stable MW', 'Fault kA', 'Availability', 'Gen. MWh/yr', 'CF', 'Gen. cost /MWh'], a.ranked.map(function (o) {
      return [o.label, o.pass ? 'yes' : 'no (' + [!o.exportOk && 'turn-down', !o.faultOk && 'fault', !o.availOk && 'availability'].filter(Boolean).join(', ') + ')', fmt(o.installed, 1), fmt(o.floor, 2), fmt(o.iTot, 1), fmt(100 * o.avail, 1) + '%', fmt(o.dispatch.genMWh, 0), fmt(100 * o.dispatch.cf, 0) + '%', fmt(o.genCost, 1)];
    })));
    a.selected.forEach(function (o, i) {
      L.push('## Option ' + (i === 0 ? 'A' : 'B') + ': ' + o.label);
      L.push('### E5 Electrical screening');
      L.push(mdTable(['Check', 'Status', 'Detail'], SLD_CHECKS.map(function (ck) {
        var auto = o.elec.checks[ck.id], man = (p.checks || []).filter(function (x) { return x.id === ck.id; })[0] || {};
        return [ck.id + ' ' + ck.title, auto ? auto.status : man.status, auto ? auto.detail : (man.note || ck.hint)];
      })));
      L.push('### E6 Gas');
      L.push('- Fuel at full duty output ' + fmt(o.gas.fuel_mw_full, 1) + ' MW, about ' + fmt(o.gas.nm3h_full, 0) + ' Nm³/h; ' + fmt(o.gas.annual_mmbtu, 0) + ' MMBtu/yr');
      o.gas.options.forEach(function (g) { if (g.price !== null) L.push('- ' + g.name + ' at ' + fmt(g.price, 2) + ': generation cost ' + fmt(g.genCost, 1) + ' ' + c + '/MWh, spread to tariff ' + fmt(g.spread, 1)); });
      L.push('### E7 Heat');
      L.push(o.heat.enabled ? '- Heat available ' + fmt(o.heat.annual_avail_mwh, 0) + ' MWh/yr, used ' + fmt(o.heat.used_mwh, 0) + ' MWh/yr, credit ' + fmtMoney(o.heat.credit, c) + '/yr' : '- Electric-only case (no heat user recorded).');
      L.push('### E10 Cost estimate');
      L.push(mdTable(['Item', 'Cost (' + c + ')'], o.econ.capexLines.map(function (l) { return [l.item, fmt(l.cost, 0)]; }).concat([['**Total**', '**' + fmt(o.econ.capex, 0) + '**']])));
      L.push('### E11 Business case');
      var e = o.econ;
      L.push(mdTable(['Metric', 'Value'], [
        ['Generation', fmt(e.genMWh, 0) + ' MWh/yr (' + o.dispatch.method + ')'],
        ['Avoided energy cost', fmtMoney(e.avoided, c) + '/yr'], ['Demand-charge saving credited', fmtMoney(e.demand, c) + '/yr'], ['Heat credit', fmtMoney(e.heatCredit, c) + '/yr'],
        ['Fuel', fmtMoney(e.fuel, c) + '/yr'], ['O&M', fmtMoney(e.om, c) + '/yr'], ['Fixed costs', fmtMoney(e.fixed, c) + '/yr'],
        ['Net saving, year 1', fmtMoney(e.year1, c)], ['Simple payback', e.simplePayback ? fmt(e.simplePayback, 1) + ' years' : 'none'],
        ['NPV at ' + fmt(v.discount_pct, 0) + '% over ' + v.years + ' years', fmtMoney(e.npv, c)], ['IRR', e.irr !== null ? fmt(100 * e.irr, 1) + '%' : 'n/a'],
        ['LCOE', fmt(e.lcoe, 1) + ' ' + c + '/MWh'], ['Indicative PPA price at ' + fmt(v.ppa_irr_pct, 0) + '% investor IRR', fmt(e.ppa, 1) + ' ' + c + '/MWh'],
        ['Client saving under that PPA', fmtMoney(e.ppaClientSaving, c) + '/yr']
      ]));
      L.push('Sensitivities (simple payback, years):');
      L.push(mdTable(['Driver', 'Low case', 'High case'], o.sens.map(function (s) { return [s.name + ' (' + s.lo + ' / ' + s.hi + ')', s.pbLo ? fmt(s.pbLo, 1) : 'none', s.pbHi ? fmt(s.pbHi, 1) : 'none']; })));
    });
    L.push('## E1 Assumptions log');
    var all = a.assumptions.concat(p.assumptions || []);
    L.push(all.length ? mdTable(['Item', 'Assumption', 'Source or fallback', 'Risk'], all.map(function (x) { return [x.item, x.assumption, x.source, x.risk]; })) : 'None recorded.\n');
    L.push('## E12 Risk register');
    L.push(mdTable(['Risk', 'What happens', 'Mitigation', 'L', 'I'], (p.risks || []).map(function (r) { return [r.risk, r.effect, r.mitigation, r.l, r.i]; })));
    L.push('## E13 Schedule');
    L.push(mdTable(['Task', 'Start (week)', 'Duration (weeks)'], (p.schedule || []).map(function (s) { return [s.task, s.start, s.weeks]; })));
    L.push('## E14 Internal review');
    L.push(mdTable(['Review', 'Name', 'Date', 'Status', 'Note'], (p.review || []).map(function (r) { return [r.role, r.name, r.date, r.status, r.note]; })));
    L.push('## Exercise status');
    L.push(mdTable(['Exercise', 'Status', 'Note'], p.exercises.map(function (e) { return [e.id + ' ' + exTitle(e.id), e.status, e.note]; })));
    return L.join('\n') + '\n';
  }

  function proposalMd(p, a) {
    a = a || analyse(p);
    var c = cur(p), v = a.v, L = [], A = a.selected[0], B = a.selected[1];
    L.push('# Proposal (draft): ' + title(p));
    L.push('');
    L.push('Prepared for ' + val(p, 'client.name') + ' by ' + val(p, 'team.tsm') + '. Budgetary proposal, accuracy about ±30%.');
    L.push('');
    L.push('## 1. Executive summary');
    L.push('- **Your objective:** ' + val(p, 'obj.drivers') + '; ' + val(p, 'obj.operating_mode') + ', ' + val(p, 'obj.grid_mode') + ', ' + val(p, 'obj.export') + '.');
    if (A) L.push('- **Recommendation:** ' + A.label + ', connected at ' + fmt(v.vconn, 1) + ' kV behind the utility meter' + (p.fields['elec.candidate_bus'] ? ' on ' + p.fields['elec.candidate_bus'] : '') + '.');
    if (A) L.push('- **Savings:** about ' + fmtMoney(A.econ.year1, c) + ' per year in year 1; simple payback about ' + (A.econ.simplePayback ? fmt(A.econ.simplePayback, 1) : '–') + ' years; IRR ' + (A.econ.irr !== null ? fmt(100 * A.econ.irr, 1) + '%' : 'n/a') + '.');
    L.push('- **Next step:** ' + val(p, 's4.next_step') + (p.fields['s4.next_step_cost'] ? ', ' + fmtMoney(p.fields['s4.next_step_cost'], c) : '') + (p.fields['s4.next_step_weeks'] ? ', ' + p.fields['s4.next_step_weeks'] + ' weeks' : '') + '.');
    L.push('');
    L.push('_[Agent: write 3 to 4 sentences in plain language tying the recommendation to the client\'s stated drivers.]_');
    L.push('');
    L.push('## 2. Options compared');
    var opts = [A, B].filter(Boolean);
    L.push(mdTable(['', ].concat(opts.map(function (o, i) { return (i ? 'Option B: ' : 'Option A: ') + o.label; })), [
      ['Passes turn-down, fault and availability checks'].concat(opts.map(function (o) { return o.pass ? 'yes' : 'NO: ' + [!o.exportOk && 'turn-down', !o.faultOk && 'fault level', !o.availOk && 'availability'].filter(Boolean).join(', '); })),
      ['Installed (site-rated)'].concat(opts.map(function (o) { return fmt(o.installed, 1) + ' MW'; })),
      ['Lowest stable output vs site minimum'].concat(opts.map(function (o) { return fmt(o.floor, 2) + ' vs ' + fmt(v.minload, 2) + ' MW'; })),
      ['Fault level vs switchboard rating'].concat(opts.map(function (o) { return fmt(o.iTot, 1) + ' vs ' + fmt(v.rating, 1) + ' kA'; })),
      ['Chance of full output'].concat(opts.map(function (o) { return fmt(100 * o.avail, 1) + '%'; })),
      ['Generation'].concat(opts.map(function (o) { return fmt(o.dispatch.genMWh, 0) + ' MWh/yr'; })),
      ['Capex'].concat(opts.map(function (o) { return fmtMoney(o.econ.capex, c); })),
      ['Net saving, year 1'].concat(opts.map(function (o) { return fmtMoney(o.econ.year1, c); })),
      ['Simple payback'].concat(opts.map(function (o) { return o.econ.simplePayback ? fmt(o.econ.simplePayback, 1) + ' yr' : 'none'; })),
      ['NPV / IRR'].concat(opts.map(function (o) { return fmtMoney(o.econ.npv, c) + ' / ' + (o.econ.irr !== null ? fmt(100 * o.econ.irr, 1) + '%' : 'n/a'); })),
      ['Indicative PPA price'].concat(opts.map(function (o) { return fmt(o.econ.ppa, 1) + ' ' + c + '/MWh'; }))
    ]));
    L.push('## 3. Technical solution');
    L.push('- Concept SLD: new generator incomer bay on ' + val(p, 'elec.candidate_bus') + '; protection 87G, 32/32R, 40, 46, 27/59, 81 O/U, 51V, 64, 25, ROCOF or vector shift.');
    L.push('- Spare bay: ' + val(p, 'elec.spare_bay') + '. Switchboard ' + fmt(v.rating, 1) + ' kA.');
    L.push('- Zero-export control with an import margin of ' + fmt(v.import_margin_mw, 2) + ' MW.');
    L.push('- Gas: ' + val(p, 'obj.gas_source') + ', about ' + (A ? fmt(A.gas.nm3h_full, 0) : '–') + ' Nm³/h at full output.');
    L.push('- Heat recovery: ' + (v.heat_on ? 'yes (' + val(p, 'heat.type') + ')' : 'not included (electric only)') + '.');
    L.push('- _[Agent: attach the concept SLD, site layout and equipment list.]_');
    L.push('');
    L.push('## 4. Financials');
    if (A) {
      L.push(mdTable(['Item', 'Cost (' + c + ')'], A.econ.capexLines.map(function (l) { return [l.item, fmt(l.cost, 0)]; }).concat([['Total capex', fmt(A.econ.capex, 0)]])));
      L.push('Sensitivities for Option A (simple payback, years):');
      L.push(mdTable(['Driver', 'Low', 'High'], A.sens.map(function (s) { return [s.name + ' (' + s.lo + ' / ' + s.hi + ')', s.pbLo ? fmt(s.pbLo, 1) : 'none', s.pbHi ? fmt(s.pbHi, 1) : 'none']; })));
    }
    L.push('## 5. Commercial offer');
    L.push('- Offer type: ' + val(p, 's4.offer_type') + '. Client preference: ' + val(p, 'com.model') + '.');
    L.push('- _[Agent: state price basis, validity, exclusions, PPA terms if offered: tariff structure, take-or-pay, gas pass-through, availability guarantee, term.]_');
    L.push('');
    L.push('## 6. Schedule');
    L.push(mdTable(['Task', 'Start (week)', 'Weeks'], (p.schedule || []).map(function (s) { return [s.task, s.start, s.weeks]; })));
    L.push('## 7. Risks and assumptions');
    L.push(mdTable(['Risk', 'Mitigation'], (p.risks || []).map(function (r) { return [r.risk, r.mitigation]; })));
    var all = a.assumptions.concat(p.assumptions || []);
    L.push(all.length ? mdTable(['Assumption', 'Basis'], all.map(function (x) { return [x.item + ': ' + x.assumption, x.source]; })) : 'No open assumptions.\n');
    L.push('## 8. The ask');
    L.push('- ' + val(p, 's4.next_step') + ': scope _[agent to fill]_, cost ' + (p.fields['s4.next_step_cost'] ? fmtMoney(p.fields['s4.next_step_cost'], c) : '_[cost]_') + ', duration ' + val(p, 's4.next_step_weeks', 'weeks') + '.');
    return L.join('\n') + '\n';
  }

  function statusMd(p) {
    var L = [];
    L.push('# Status: ' + title(p));
    L.push('');
    STAGES.forEach(function (s) {
      var st = p.stages[s.n], pr = stageProgress(p, s.n);
      L.push('- ' + (p.current_stage === s.n ? '**' : '') + s.title + (p.current_stage === s.n ? '**' : '') + ': ' + st.status.replace('_', ' ') + ', ' + pr.pct + '%' + (st.skip_reason ? ' (' + st.skip_reason + ')' : ''));
    });
    var pr = stageProgress(p, p.current_stage);
    L.push('');
    L.push('## Open items in stage ' + p.current_stage);
    pr.missing.forEach(function (k) { L.push('- ' + FIELDS[k].l + ' [' + k + ']'); });
    pr.extra.forEach(function (x) { L.push('- ' + x); });
    pr.deliverables.filter(function (d) { return !d.done; }).forEach(function (d) { L.push('- Deliverable: ' + d.title + ' [' + d.id + ']'); });
    if (!pr.missing.length && !pr.extra.length && pr.deliverables.every(function (d) { return d.done; })) L.push('- Nothing open. Ready to complete the stage.');
    return L.join('\n') + '\n';
  }

  return {
    SCHEMA: SCHEMA, VERSION: VERSION, CALC_DEFAULTS: CALC_DEFAULTS, ENGINE_CLASSES: ENGINE_CLASSES, STAGES: STAGES, FIELDS: FIELDS,
    DATA_REQUEST: DATA_REQUEST, DR_STATUS: DR_STATUS, EXERCISES: EXERCISES, EX_STATUS: EX_STATUS, SLD_CHECKS: SLD_CHECKS, CHECK_STATUS: CHECK_STATUS,
    newProject: newProject, migrate: migrate, validate: validate, parseProject: parseProject, serialize: serialize, fileName: fileName,
    setField: setField, setUnknown: setUnknown, answered: answered, parseValue: parseValue, addLog: addLog,
    stageProgress: stageProgress, setStage: setStage, addDeliverable: addDeliverable,
    parseLoadCsv: parseLoadCsv, importLoad: importLoad, parseBillsCsv: parseBillsCsv, loadStats: loadStats, billsStats: billsStats,
    resolveInputs: resolveInputs, rateTable: rateTable, analyse: analyse, snapshot: snapshot, economics: economics,
    hypothesisMd: hypothesisMd, meetingPackMd: meetingPackMd, dataRequestMd: dataRequestMd, dataRequestCsv: dataRequestCsv,
    resultsMd: resultsMd, proposalMd: proposalMd, statusMd: statusMd,
    fmt: fmt, fmtMoney: fmtMoney, slugify: slugify, pAtLeast: pAtLeast, irr: irr, npv: npv, crf: crf, nowIso: nowIso
  };
});
