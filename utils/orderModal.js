const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  create(orderId) {
    const modal = new ModalBuilder()
      .setCustomId(`orderModal_${orderId}`)
      .setTitle('Order Details');

    const qtyInput = new TextInputBuilder()
      .setCustomId('qty')
      .setLabel('Quantity')
      .setPlaceholder('Berapa unit?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(5);

    const notesInput = new TextInputBuilder()
      .setCustomId('notes')
      .setLabel('Notes (Optional)')
      .setPlaceholder('Catatan tambahan...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const qtyRow = new ActionRowBuilder().addComponents(qtyInput);
    const notesRow = new ActionRowBuilder().addComponents(notesInput);

    modal.addComponents(qtyRow, notesRow);

    return modal;
  }
};
