const assert = require('node:assert/strict');

(async () => {
  try {
    const eventsModel = require('../models/eventsModel');

    assert.ok(eventsModel, 'eventsModel should be exported');
    assert.strictEqual(typeof eventsModel.createEvent, 'function');
    assert.strictEqual(typeof eventsModel.publishEvent, 'function');
    assert.strictEqual(typeof eventsModel.getEvents, 'function');
    assert.strictEqual(typeof eventsModel.getEventById, 'function');
    assert.strictEqual(typeof eventsModel.registerForEvent, 'function');
    assert.strictEqual(typeof eventsModel.getAttendees, 'function');
    assert.strictEqual(typeof eventsModel.submitEventFeedback, 'function');
    assert.strictEqual(typeof eventsModel.getEventAuditLog, 'function');

    const event = await eventsModel.createEvent({
      title: 'ACC Trade Webinar',
      description: 'A digital trade briefing for African business leaders.',
      organizer: 'African Chamber of Commerce',
      eventType: 'virtual',
      eventFormat: 'virtual',
      startDate: '2026-09-01T15:00:00.000Z',
      endDate: '2026-09-01T17:00:00.000Z',
      location: 'https://zoom.us/acc-trade-webinar',
      visibility: 'public',
      capacity: 120,
      ticketType: 'free',
      price: 0,
      createdBy: 1,
    });

    assert.ok(event && event.id, 'event should be created');
    assert.equal(event.visibility, 'public', 'event visibility should be preserved');

    const published = await eventsModel.publishEvent(event.id, 1);
    assert.ok(published && published.success, 'event should publish successfully');

    const feed = await eventsModel.getEvents({ page: 1, limit: 10, visibility: 'public' });
    assert.ok(Array.isArray(feed.events), 'event list should be returned');
    assert.ok(feed.events.length >= 1, 'event list should contain at least one event');

    const registration = await eventsModel.registerForEvent(7, event.id, {
      name: 'Ada',
      email: 'ada@example.com',
      ticketType: 'standard',
    });

    assert.ok(registration && registration.success, 'user should be able to register');

    const attendees = await eventsModel.getAttendees(event.id);
    assert.ok(Array.isArray(attendees), 'attendance should be returned');
    assert.ok(attendees.some((item) => Number(item.userId) === 7), 'registered user should be in attendee list');

    const feedback = await eventsModel.submitEventFeedback(7, event.id, {
      rating: 5,
      comments: 'Excellent event and clear trade insights.',
    });

    assert.ok(feedback && feedback.success, 'feedback should be recorded');

    const audit = await eventsModel.getEventAuditLog(event.id, 10);
    assert.ok(Array.isArray(audit), 'audit log should be returned');

    console.log('Chapter 15 events test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 15 events test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
