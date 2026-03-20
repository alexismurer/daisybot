import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Interaction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { UserPersona } from '../../memory/types';
import { loadPersona, savePersona } from '../../memory/persona';

// ── Wizard state ──────────────────────────────────────────────────────────────

export interface WizardEntry {
  data: Partial<UserPersona>;
  originalInteraction: ChatInputCommandInteraction;
  expiresAt: number;
  editMode?: boolean;
}

const WIZARD_TTL_MS = 15 * 60 * 1000;

export class WizardState {
  private store = new Map<string, WizardEntry>();

  set(userId: string, entry: Omit<WizardEntry, 'expiresAt'>): void {
    this.store.set(userId, { ...entry, expiresAt: Date.now() + WIZARD_TTL_MS });
  }

  get(userId: string): WizardEntry | null {
    const entry = this.store.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(userId);
      return null;
    }
    return entry;
  }

  update(userId: string, data: Partial<UserPersona>): void {
    const entry = this.get(userId);
    if (!entry) return;
    this.store.set(userId, {
      ...entry,
      data: { ...entry.data, ...data },
      expiresAt: Date.now() + WIZARD_TTL_MS,
    });
  }

  delete(userId: string): void {
    this.store.delete(userId);
  }
}

export const wizardState = new WizardState();

// ── Placeholders (filled in subsequent tasks) ─────────────────────────────────

export const data: ReturnType<typeof buildCommandData> = buildCommandData();

function buildCommandData() {
  return new SlashCommandBuilder()
    .setName('persona')
    .setDescription('Configure how I interact with you')
    .addSubcommand((s) => s.setName('setup').setDescription('Set up your persona from scratch'))
    .addSubcommand((s) => s.setName('view').setDescription('View your current persona settings'))
    .addSubcommand((s) => s.setName('edit').setDescription('Edit a specific persona setting'))
    .addSubcommand((s) => s.setName('reset').setDescription('Reset persona to defaults'));
}

// ── NSFW check ─────────────────────────────────────────────────────────────

function isNsfwAllowed(interaction: ChatInputCommandInteraction): boolean {
  const ch = interaction.channel;
  return !!(ch?.isDMBased() || (ch && 'nsfw' in ch && (ch as { nsfw: boolean }).nsfw));
}

// ── /persona view ──────────────────────────────────────────────────────────

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const persona = await loadPersona(interaction.user.id);
  if (!persona) {
    await interaction.reply({
      content: "You haven't set up a persona yet. Run `/persona setup` to get started.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle('Your Persona Settings')
    .addFields(
      { name: 'Gender', value: persona.bot_gender, inline: true },
      { name: 'Speaking style', value: persona.speaking_style, inline: true },
      { name: 'Relationship', value: persona.relationship, inline: true },
      { name: 'Custom instructions', value: persona.custom_instructions ?? 'None' },
      { name: 'Appearance', value: persona.bot_appearance ?? 'Not set' },
      { name: 'Age', value: persona.bot_age ?? 'Not set' }
    )
    .setColor(0x5865f2);
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ── /persona reset ─────────────────────────────────────────────────────────

async function handleReset(interaction: ChatInputCommandInteraction): Promise<void> {
  const confirm = new ButtonBuilder()
    .setCustomId('persona:confirm_reset')
    .setLabel('Yes, reset')
    .setStyle(ButtonStyle.Danger);
  const cancel = new ButtonBuilder()
    .setCustomId('persona:cancel_reset')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);
  await interaction.reply({
    content: 'This will clear all your persona settings. Are you sure?',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// ── /persona edit ──────────────────────────────────────────────────────────

async function handleEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  const existing = await loadPersona(interaction.user.id);
  wizardState.set(interaction.user.id, {
    data: existing ?? {},
    originalInteraction: interaction,
    editMode: true,
  });
  const select = new StringSelectMenuBuilder()
    .setCustomId('persona:edit:field_selector')
    .setPlaceholder('Which setting do you want to change?')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Bot gender').setValue('persona:edit:gender'),
      new StringSelectMenuOptionBuilder().setLabel('Speaking style').setValue('persona:edit:style'),
      new StringSelectMenuOptionBuilder().setLabel('Relationship').setValue('persona:edit:relationship'),
      new StringSelectMenuOptionBuilder().setLabel('Custom instructions').setValue('persona:edit:instructions'),
      new StringSelectMenuOptionBuilder().setLabel('Appearance').setValue('persona:edit:appearance'),
      new StringSelectMenuOptionBuilder().setLabel('Age').setValue('persona:edit:age')
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.reply({
    content: 'What would you like to change?',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// ── main execute ───────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isNsfwAllowed(interaction)) {
    await interaction.reply({
      content: 'Persona settings can only be configured in an age-restricted (NSFW) channel or DM.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const sub = interaction.options.getSubcommand();
  if (sub === 'view') return handleView(interaction);
  if (sub === 'reset') return handleReset(interaction);
  if (sub === 'edit') return handleEdit(interaction);
  if (sub === 'setup') return handleSetup(interaction);
}

// ── Step builders ──────────────────────────────────────────────────────────

function buildStep1() {
  const labels: Record<string, string> = { male: 'Male', female: 'Female', nonbinary: 'Non-binary', neutral: 'Neutral' };
  const buttons = Object.entries(labels).map(([value, label]) =>
    new ButtonBuilder().setCustomId(`persona:gender:${value}`).setLabel(label).setStyle(ButtonStyle.Primary)
  );
  return {
    content: '**Step 1 of 6 — How should I present myself?**',
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)],
    embeds: [],
    flags: MessageFlags.Ephemeral,
  };
}

function buildStep2() {
  const options = [
    ['Friendly', 'friendly'], ['Polite', 'polite'], ['Sarcastic', 'sarcastic'],
    ['Flirty', 'flirty'], ['Dirty-minded', 'dirty'], ['Slang', 'slang'],
    ['Gentle', 'gentle'], ['Custom…', 'persona:style:custom'],
  ];
  const select = new StringSelectMenuBuilder()
    .setCustomId('persona:style:select')
    .setPlaceholder('Pick a speaking style')
    .addOptions(options.map(([label, value]) =>
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)
    ));
  return {
    content: '**Step 2 of 6 — How should I speak?**',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    embeds: [],
  };
}

function buildStep3() {
  const options = [
    ['Helpful assistant', 'assistant'], ['Best friend', 'best_friend'],
    ['Romantic partner', 'romantic_partner'], ['Mentor / Coach', 'mentor'],
    ['Therapist', 'therapist'], ['Custom…', 'persona:relationship:custom'],
  ];
  const select = new StringSelectMenuBuilder()
    .setCustomId('persona:relationship:select')
    .setPlaceholder('Pick a relationship dynamic')
    .addOptions(options.map(([label, value]) =>
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)
    ));
  return {
    content: '**Step 3 of 6 — What is our relationship?**',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    embeds: [],
  };
}

function buildStep4() {
  const add = new ButtonBuilder()
    .setCustomId('persona:add_instructions')
    .setLabel('Add instructions')
    .setStyle(ButtonStyle.Primary);
  const skip = new ButtonBuilder()
    .setCustomId('persona:skip_instructions')
    .setLabel('Skip')
    .setStyle(ButtonStyle.Secondary);
  return {
    content: '**Step 4 of 6 — Any extra instructions for me?**',
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(add, skip)],
    embeds: [],
  };
}

function buildStep5() {
  const add = new ButtonBuilder()
    .setCustomId('persona:add_appearance')
    .setLabel('Add appearance')
    .setStyle(ButtonStyle.Primary);
  const skip = new ButtonBuilder()
    .setCustomId('persona:skip_appearance')
    .setLabel('Skip')
    .setStyle(ButtonStyle.Secondary);
  return {
    content: '**Step 5 of 6 — What do I look like? (optional)**',
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(add, skip)],
    embeds: [],
  };
}

function buildStep6() {
  const add = new ButtonBuilder()
    .setCustomId('persona:add_age')
    .setLabel('Set age')
    .setStyle(ButtonStyle.Primary);
  const skip = new ButtonBuilder()
    .setCustomId('persona:skip_age')
    .setLabel('Skip')
    .setStyle(ButtonStyle.Secondary);
  return {
    content: '**Step 6 of 6 — How old am I? (optional)**',
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(add, skip)],
    embeds: [],
  };
}

function buildConfirm(data: Partial<UserPersona>) {
  const embed = new EmbedBuilder()
    .setTitle('Confirm your persona')
    .addFields(
      { name: 'Gender', value: data.bot_gender ?? 'neutral', inline: true },
      { name: 'Speaking style', value: data.speaking_style ?? 'friendly', inline: true },
      { name: 'Relationship', value: data.relationship ?? 'assistant', inline: true },
      { name: 'Custom instructions', value: data.custom_instructions ?? 'None' },
      { name: 'Appearance', value: data.bot_appearance ?? 'Not set' },
      { name: 'Age', value: data.bot_age ?? 'Not set' }
    )
    .setColor(0x5865f2);
  const save = new ButtonBuilder().setCustomId('persona:confirm_save').setLabel('Save').setStyle(ButtonStyle.Success);
  const restart = new ButtonBuilder().setCustomId('persona:restart').setLabel('Start over').setStyle(ButtonStyle.Secondary);
  return {
    content: 'Does this look right?',
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(save, restart)],
  };
}

// ── handleSetup ────────────────────────────────────────────────────────────

async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  wizardState.set(interaction.user.id, { data: {}, originalInteraction: interaction });
  await interaction.reply({ ...buildStep1(), flags: MessageFlags.Ephemeral });
}

// ── Edit-mode save helper ──────────────────────────────────────────────────

async function savePersonaFromEntry(userId: string, data: Partial<UserPersona>): Promise<void> {
  await savePersona(userId, {
    bot_gender: data.bot_gender ?? 'neutral',
    speaking_style: data.speaking_style ?? 'friendly',
    relationship: data.relationship ?? 'assistant',
    custom_instructions: data.custom_instructions ?? null,
    bot_appearance: data.bot_appearance ?? null,
    bot_age: data.bot_age ?? null,
  });
}

// ── handlePersonaComponent ─────────────────────────────────────────────────

export async function handlePersonaComponent(interaction: Interaction): Promise<void> {
  if (!('customId' in interaction)) return;

  // Type the interaction loosely — it may be Button, Select, or ModalSubmit
  const i = interaction as unknown as {
    user: { id: string };
    customId: string;
    update: (d: object) => Promise<void>;
    reply: (d: object) => Promise<void>;
    deferReply: (d: object) => Promise<void>;
    deleteReply: () => Promise<void>;
    showModal: (m: object) => Promise<void>;
    editReply: (d: object) => Promise<void>;
    values?: string[];
    fields?: { getTextInputValue: (id: string) => string };
  };
  const { user, customId } = i;
  const userId = user.id;

  // ── Reset (no wizard state needed) ─────────────────────────────────────
  if (customId === 'persona:confirm_reset') {
    await savePersona(userId, { bot_gender: 'neutral', speaking_style: 'friendly', relationship: 'assistant', custom_instructions: null, bot_appearance: null, bot_age: null });
    await i.update({ content: '✅ Persona reset to defaults.', components: [], embeds: [] });
    return;
  }
  if (customId === 'persona:cancel_reset') {
    await i.update({ content: 'Reset cancelled.', components: [], embeds: [] });
    return;
  }

  // ── All remaining interactions require wizard state ─────────────────────
  const entry = wizardState.get(userId);
  if (!entry) {
    await i.reply({ content: 'Your setup session has expired. Run `/persona setup` to start again.', flags: MessageFlags.Ephemeral });
    return;
  }

  // ── Edit mode: field selector ────────────────────────────────────────────
  if (customId === 'persona:edit:field_selector') {
    const value = i.values?.[0] ?? '';
    if (value === 'persona:edit:gender') await i.update(buildStep1());
    else if (value === 'persona:edit:style') await i.update(buildStep2());
    else if (value === 'persona:edit:relationship') await i.update(buildStep3());
    else if (value === 'persona:edit:instructions') await i.update(buildStep4());
    else if (value === 'persona:edit:appearance') await i.update(buildStep5());
    else if (value === 'persona:edit:age') await i.update(buildStep6());
    return;
  }

  // ── Step 1 → 2: gender button ───────────────────────────────────────────
  if (customId.startsWith('persona:gender:')) {
    wizardState.update(userId, { bot_gender: customId.split(':')[2] });
    if (entry.editMode) {
      const updated = wizardState.get(userId)!;
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
      await i.update({ content: '✅ Gender updated!', components: [], embeds: [] });
    } else {
      await i.update(buildStep2());
    }
    return;
  }

  // ── Step 2 → 3: style select ────────────────────────────────────────────
  if (customId === 'persona:style:select') {
    const value = i.values?.[0] ?? '';
    if (!value) return;
    if (value === 'persona:style:custom') {
      const modal = new ModalBuilder()
        .setCustomId('persona:style:modal')
        .setTitle('Custom speaking style')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('value').setLabel('How should I speak?').setStyle(TextInputStyle.Short).setMaxLength(100)
          )
        );
      await i.showModal(modal);
      return;
    }
    wizardState.update(userId, { speaking_style: value });
    if (entry.editMode) {
      const updated = wizardState.get(userId)!;
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
      await i.update({ content: '✅ Speaking style updated!', components: [], embeds: [] });
    } else {
      await i.update(buildStep3());
    }
    return;
  }

  // ── Step 2 custom modal submit ──────────────────────────────────────────
  if (customId === 'persona:style:modal') {
    const value = i.fields?.getTextInputValue('value').trim() ?? '';
    wizardState.update(userId, { speaking_style: value });
    const updated = wizardState.get(userId)!;
    const nextPayload = entry.editMode
      ? { content: '✅ Speaking style updated!', components: [], embeds: [] }
      : buildStep3();
    if (entry.editMode) {
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.deleteReply();
    await (entry.originalInteraction as unknown as { editReply: (d: object) => Promise<void> }).editReply(nextPayload);
    return;
  }

  // ── Step 3 → 4: relationship select ────────────────────────────────────
  if (customId === 'persona:relationship:select') {
    const value = i.values?.[0] ?? '';
    if (!value) return;
    if (value === 'persona:relationship:custom') {
      const modal = new ModalBuilder()
        .setCustomId('persona:relationship:modal')
        .setTitle('Custom relationship')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('value').setLabel('What is our relationship?').setStyle(TextInputStyle.Short).setMaxLength(100)
          )
        );
      await i.showModal(modal);
      return;
    }
    wizardState.update(userId, { relationship: value });
    if (entry.editMode) {
      const updated = wizardState.get(userId)!;
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
      await i.update({ content: '✅ Relationship updated!', components: [], embeds: [] });
    } else {
      await i.update(buildStep4());
    }
    return;
  }

  // ── Step 3 custom modal submit ──────────────────────────────────────────
  if (customId === 'persona:relationship:modal') {
    const value = i.fields?.getTextInputValue('value').trim() ?? '';
    wizardState.update(userId, { relationship: value });
    const updated = wizardState.get(userId)!;
    const nextPayload = entry.editMode
      ? { content: '✅ Relationship updated!', components: [], embeds: [] }
      : buildStep4();
    if (entry.editMode) {
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.deleteReply();
    await (entry.originalInteraction as unknown as { editReply: (d: object) => Promise<void> }).editReply(nextPayload);
    return;
  }

  // ── Step 4: instructions ────────────────────────────────────────────────
  if (customId === 'persona:add_instructions') {
    const modal = new ModalBuilder()
      .setCustomId('persona:instructions:modal')
      .setTitle('Custom instructions')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('value').setLabel('Anything else I should know?').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(false)
        )
      );
    await i.showModal(modal);
    return;
  }

  if (customId === 'persona:skip_instructions') {
    wizardState.update(userId, { custom_instructions: null });
    if (entry.editMode) {
      const updated = wizardState.get(userId)!;
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
      await i.update({ content: '✅ Custom instructions cleared!', components: [], embeds: [] });
    } else {
      await i.update(buildStep5());
    }
    return;
  }

  if (customId === 'persona:instructions:modal') {
    const value = i.fields?.getTextInputValue('value').trim() ?? '';
    const customInstructions = value || null;
    wizardState.update(userId, { custom_instructions: customInstructions });
    const updated = wizardState.get(userId)!;
    const nextPayload = entry.editMode
      ? { content: '✅ Custom instructions updated!', components: [], embeds: [] }
      : buildStep5();
    if (entry.editMode) {
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.deleteReply();
    await (entry.originalInteraction as unknown as { editReply: (d: object) => Promise<void> }).editReply(nextPayload);
    return;
  }

  // ── Step 5: appearance ──────────────────────────────────────────────────
  if (customId === 'persona:add_appearance') {
    const modal = new ModalBuilder()
      .setCustomId('persona:appearance:modal')
      .setTitle('My appearance')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('value').setLabel('Describe my appearance').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(false)
        )
      );
    await i.showModal(modal);
    return;
  }

  if (customId === 'persona:skip_appearance') {
    wizardState.update(userId, { bot_appearance: null });
    if (entry.editMode) {
      const updated = wizardState.get(userId)!;
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
      await i.update({ content: '✅ Appearance cleared!', components: [], embeds: [] });
    } else {
      await i.update(buildStep6());
    }
    return;
  }

  if (customId === 'persona:appearance:modal') {
    const value = i.fields?.getTextInputValue('value').trim() ?? '';
    const botAppearance = value || null;
    wizardState.update(userId, { bot_appearance: botAppearance });
    const updated = wizardState.get(userId)!;
    const nextPayload = entry.editMode
      ? { content: '✅ Appearance updated!', components: [], embeds: [] }
      : buildStep6();
    if (entry.editMode) {
      await savePersonaFromEntry(userId, updated.data);
      wizardState.delete(userId);
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.deleteReply();
    await (entry.originalInteraction as unknown as { editReply: (d: object) => Promise<void> }).editReply(nextPayload);
    return;
  }

  // ── Step 6: age ─────────────────────────────────────────────────────────
  if (customId === 'persona:add_age') {
    const modal = new ModalBuilder()
      .setCustomId('persona:age:modal')
      .setTitle('My age')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('value').setLabel('How old am I?').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(false)
        )
      );
    await i.showModal(modal);
    return;
  }

  if (customId === 'persona:skip_age') {
    wizardState.update(userId, { bot_age: null });
    const updatedEntry = wizardState.get(userId)!;
    if (entry.editMode) {
      await savePersonaFromEntry(userId, updatedEntry.data);
      wizardState.delete(userId);
      await i.update({ content: '✅ Age cleared!', components: [], embeds: [] });
    } else {
      await i.update(buildConfirm(updatedEntry.data));
    }
    return;
  }

  if (customId === 'persona:age:modal') {
    const value = i.fields?.getTextInputValue('value').trim() ?? '';
    const botAge = value || null;
    wizardState.update(userId, { bot_age: botAge });
    const updatedEntry = wizardState.get(userId)!;
    const nextPayload = entry.editMode
      ? { content: '✅ Age updated!', components: [], embeds: [] }
      : buildConfirm(updatedEntry.data);
    if (entry.editMode) {
      await savePersonaFromEntry(userId, updatedEntry.data);
      wizardState.delete(userId);
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.deleteReply();
    await (entry.originalInteraction as unknown as { editReply: (d: object) => Promise<void> }).editReply(nextPayload);
    return;
  }

  // ── Confirm / restart ───────────────────────────────────────────────────
  if (customId === 'persona:confirm_save') {
    const d = wizardState.get(userId)!.data;
    await savePersona(userId, {
      bot_gender: d.bot_gender ?? 'neutral',
      speaking_style: d.speaking_style ?? 'friendly',
      relationship: d.relationship ?? 'assistant',
      custom_instructions: d.custom_instructions ?? null,
      bot_appearance: d.bot_appearance ?? null,
      bot_age: d.bot_age ?? null,
    });
    wizardState.delete(userId);
    await i.update({ content: '✅ Persona saved! I\'ll use these settings from now on.', components: [], embeds: [] });
    return;
  }

  if (customId === 'persona:restart') {
    const orig = entry.originalInteraction;
    wizardState.set(userId, { data: {}, originalInteraction: orig });
    await i.update(buildStep1());
    return;
  }
}
