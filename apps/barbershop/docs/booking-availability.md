# Booking availability slots

The booking UI treats every `start_at` returned by `GET /public/masters/{master_id}/available-slots` as a bookable instant. The normal starts are on a 15-minute grid, and the API can also return the exact start of a free availability window, such as `10:07`.

Do not round, filter, or recreate these values in the client. The time-picker displays the Kyiv-local hour and minute from the returned instant, and the selected API `start_at` is passed unchanged to the price quote and `POST /public/bookings`. When two ISO strings describe the same instant, selection is normalized to the availability response's representation.
