import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { rangeShape } from './DayCell.js';
import Month from './Month.js';
import { calcFocusDate, generateStyles, getMonthDisplayRange } from '../utils';
import classnames from 'classnames';
import ReactList from 'react-list';
import TimePicker from 'rc-time-picker';
import 'rc-time-picker/assets/index.css';

import {
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addYears,
  isSameDay,
  isSameMonth,
  addDays,
  differenceInCalendarMonths,
  differenceInDays,
  min,
  max,
  format,
  setYear,
  setMonth,
  eachDayOfInterval,
} from '../dateUtils';

const months = () => {
  return [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
};

import coreStyles from '../styles';
import moment from 'moment-timezone';

class Calendar extends PureComponent {
  constructor(props, context) {
    super(props, context);
    this.changeShownDate = this.changeShownDate.bind(this);
    this.focusToDate = this.focusToDate.bind(this);
    this.updateShownDate = this.updateShownDate.bind(this);
    this.handleRangeFocusChange = this.handleRangeFocusChange.bind(this);
    this.renderDateDisplay = this.renderDateDisplay.bind(this);
    this.onDragSelectionStart = this.onDragSelectionStart.bind(this);
    this.onDragSelectionEnd = this.onDragSelectionEnd.bind(this);
    this.onDragSelectionMove = this.onDragSelectionMove.bind(this);
    this.renderMonthAndYear = this.renderMonthAndYear.bind(this);
    this.updatePreview = this.updatePreview.bind(this);
    this.estimateMonthSize = this.estimateMonthSize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.styles = generateStyles([coreStyles, props.classNames]);
    this.listSizeCache = {};
    this.state = {
      focusedDate: calcFocusDate(null, props),
      drag: {
        status: false,
        range: { startDate: null, endDate: null },
        disablePreview: false,
      },
      scrollArea: this.calcScrollArea(props),
    };
  }

  calcScrollArea(props) {
    const { direction, months, scroll } = props;
    if (!scroll.enabled) return { enabled: false };

    const longMonthHeight = scroll.longMonthHeight || scroll.monthHeight;
    if (direction === 'vertical') {
      return {
        enabled: true,
        monthHeight: scroll.monthHeight || 220,
        longMonthHeight: longMonthHeight || 260,
        calendarWidth: 'auto',
        calendarHeight: (scroll.calendarHeight || longMonthHeight || 240) * months,
      };
    }
    return {
      enabled: true,
      monthWidth: scroll.monthWidth || 332,
      calendarWidth: (scroll.calendarWidth || scroll.monthWidth || 332) * months,
      monthHeight: longMonthHeight || 300,
      calendarHeight: longMonthHeight || 300,
    };
  }

  focusToDate(date, props = this.props, preventUnnecessary = true) {
    if (!props.scroll.enabled) {
      this.setState({ focusedDate: date });
      return;
    }
    const targetMonthIndex = differenceInCalendarMonths(date, props.minDate);
    const visibleMonths = this.list.getVisibleRange();
    if (preventUnnecessary && visibleMonths.includes(targetMonthIndex)) return;
    this.list.scrollTo(targetMonthIndex);
    this.setState({ focusedDate: date });
  }

  updateShownDate(props = this.props) {
    const newProps = props.scroll.enabled
      ? {
          ...props,
          months: this.list.getVisibleRange().length,
        }
      : props;
    const newFocus = calcFocusDate(this.state.focusedDate, newProps);
    this.focusToDate(newFocus, newProps);
  }

  updatePreview(val) {
    if (!val) {
      this.setState({ preview: null });
      return;
    }
    const preview = {
      startDate: val,
      endDate: val,
      color: this.props.color,
    };
    this.setState({ preview });
  }

  componentDidMount() {
    if (this.props.scroll.enabled) {
      // prevent react-list's initial render focus problem
      setTimeout(() => this.focusToDate(this.state.focusedDate), 1);
    }
  }

  // eslint-disable-next-line react/no-deprecated
  componentWillReceiveProps(nextProps) {
    const propMapper = {
      dateRange: 'ranges',
      date: 'date',
    };
    const targetProp = propMapper[nextProps.displayMode];
    if (JSON.stringify(this.props.scroll) !== JSON.stringify(nextProps.scroll)) {
      this.setState({ scrollArea: this.calcScrollArea(nextProps) });
    }
    if (nextProps[targetProp] !== this.props[targetProp]) {
      this.updateShownDate(nextProps);
    }
  }

  changeShownDate(value, mode = 'set') {
    const { focusedDate } = this.state;
    const { onShownDateChange, minDate, maxDate } = this.props;
    const modeMapper = {
      monthOffset: () => addMonths(focusedDate, value),
      setMonth: () => setMonth(focusedDate, value),
      setYear: () => setYear(focusedDate, value),
      set: () => value,
    };
    const newDate = min([max([modeMapper[mode](), minDate]), maxDate]);
    this.focusToDate(newDate, this.props, false);
    onShownDateChange && onShownDateChange(newDate);
  }

  handleRangeFocusChange(rangesIndex, rangeItemIndex) {
    this.props.onRangeFocusChange && this.props.onRangeFocusChange([rangesIndex, rangeItemIndex]);
  }

  handleScroll() {
    const { onShownDateChange, minDate } = this.props;
    const visibleMonths = this.list.getVisibleRange();
    // prevent scroll jump with wrong visible value
    if (visibleMonths[0] === undefined) return;
    const visibleMonth = addMonths(minDate, visibleMonths[0] || 0);
    const isFocusedToDifferent = !isSameMonth(visibleMonth, this.state.focusedDate);
    if (isFocusedToDifferent) {
      this.setState({ focusedDate: visibleMonth });
      onShownDateChange && onShownDateChange(visibleMonth);
    }
  }

  renderMonthAndYear(focusedDate, changeShownDate, props) {
    const { showMonthArrow, minDate, maxDate, showMonthAndYearPickers } = props;
    const upperYearLimit = (maxDate || Calendar.defaultProps.maxDate).getFullYear();
    const lowerYearLimit = (minDate || Calendar.defaultProps.minDate).getFullYear();
    const styles = this.styles;
    return (
      <div onMouseUp={e => e.stopPropagation()} className={styles.monthAndYearWrapper}>
        {showMonthArrow ? (
          <button
            type="button"
            className={classnames(styles.nextPrevButton, styles.prevButton)}
            onClick={() => changeShownDate(-1, 'monthOffset')}>
            <i />
          </button>
        ) : null}
        {showMonthAndYearPickers ? (
          <span className={styles.monthAndYearPickers}>
            <span className={styles.monthPicker}>
              <select
                value={focusedDate.getMonth()}
                onChange={e => changeShownDate(e.target.value, 'setMonth')}>
                {months().map((month, i) => (
                  <option key={i} value={i}>
                    {month}
                  </option>
                ))}
              </select>
            </span>
            <span className={styles.monthAndYearDivider} />
            <span className={styles.yearPicker}>
              <select
                value={focusedDate.getFullYear()}
                onChange={e => changeShownDate(e.target.value, 'setYear')}>
                {new Array(upperYearLimit - lowerYearLimit + 1)
                  .fill(upperYearLimit)
                  .map((val, i) => {
                    const year = val - i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
              </select>
            </span>
          </span>
        ) : (
          <span className={styles.monthAndYearPickers}>
            {months()[focusedDate.getMonth()]} {focusedDate.getFullYear()}
          </span>
        )}
        {showMonthArrow ? (
          <button
            type="button"
            className={classnames(styles.nextPrevButton, styles.nextButton)}
            onClick={() => changeShownDate(+1, 'monthOffset')}>
            <i />
          </button>
        ) : null}
      </div>
    );
  }

  renderWeekdays() {
    const now = new Date();
    return (
      <div className={this.styles.weekDays}>
        {eachDayOfInterval({
          start: startOfWeek(now),
          end: endOfWeek(now),
        }).map((day, i) => (
          <span className={this.styles.weekDay} key={i}>
            {format(day, 'ddd')}
          </span>
        ))}
      </div>
    );
  }

  renderDateDisplay() {
    const {
      focusedRange,
      color,
      ranges,
      rangeColors,
      updateRange,
      showTime,
      timezone,
    } = this.props;
    const defaultColor = rangeColors[focusedRange[0]] || color;
    const styles = this.styles;
    return (
      <div className={styles.dateDisplayWrapper}>
        {ranges.map((range, i) => {
          if (range.showDateDisplay === false || (range.disabled && !range.showDateDisplay))
            return null;
          return (
            <div
              className={styles.dateDisplay}
              key={i}
              style={{ color: range.color || defaultColor }}>
              <span
                className={classnames(styles.dateDisplayItem, {
                  [styles.dateDisplayItemActive]: focusedRange[0] === i && focusedRange[1] === 0,
                })}
                onFocus={() => this.handleRangeFocusChange(i, 0)}>
                <input
                  disabled={range.disabled}
                  readOnly
                  value={this.formatDateDisplay(range.startDate, 'Early')}
                />
                {showTime ? (
                  <span
                    className={classnames(styles.timePickerContainer, {
                      [styles.timePickerContainerActive]:
                        focusedRange[0] === i && focusedRange[1] === 0,
                    })}>
                    <TimePicker
                      allowEmpty={false}
                      showSecond={false}
                      onChange={value => {
                        updateRange && updateRange({ ...range, startDate: value.toDate() });
                      }}
                      clearIcon={() => {
                        return <React.Fragment />;
                      }}
                      value={moment(range.startDate).tz(timezone)}
                      use12Hours={true}
                    />
                  </span>
                ) : (
                  <React.Fragment />
                )}
              </span>
              <span
                className={classnames(styles.dateDisplayItem, {
                  [styles.dateDisplayItemActive]: focusedRange[0] === i && focusedRange[1] === 1,
                })}
                onFocus={() => this.handleRangeFocusChange(i, 1)}>
                <input
                  disabled={range.disabled}
                  readOnly
                  value={this.formatDateDisplay(range.endDate, 'Continuous')}
                />
                {showTime ? (
                  <span className={styles.timePickerContainer}>
                    <TimePicker
                      allowEmpty={false}
                      showSecond={false}
                      clearIcon={() => {
                        return <React.Fragment />;
                      }}
                      onChange={value => {
                        updateRange && updateRange({ ...range, endDate: value.toDate() });
                      }}
                      value={moment(range.endDate).tz(timezone)}
                      use12Hours={true}
                    />
                  </span>
                ) : (
                  <React.Fragment />
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  onDragSelectionStart(date) {
    const { onChange, dragSelectionEnabled } = this.props;

    if (dragSelectionEnabled) {
      this.setState({
        drag: {
          status: true,
          range: { startDate: date, endDate: date },
          disablePreview: true,
        },
      });
    } else {
      onChange && onChange(date);
    }
  }

  onDragSelectionEnd(date) {
    const { updateRange, displayMode, onChange, dragSelectionEnabled } = this.props;

    if (!dragSelectionEnabled) return;

    if (displayMode === 'date' || !this.state.drag.status) {
      onChange && onChange(date);
      return;
    }
    const newRange = {
      startDate: this.state.drag.range.startDate,
      endDate: date,
    };
    if (displayMode !== 'dateRange' || isSameDay(newRange.startDate, date)) {
      this.setState({ drag: { status: false, range: {} } }, () => onChange && onChange(date));
    } else {
      this.setState({ drag: { status: false, range: {} } }, () => {
        updateRange && updateRange(newRange);
      });
    }
  }

  onDragSelectionMove(date) {
    const { drag } = this.state;
    if (!drag.status || !this.props.dragSelectionEnabled) return;
    this.setState({
      drag: {
        status: drag.status,
        range: { startDate: drag.range.startDate, endDate: date },
        disablePreview: true,
      },
    });
  }

  estimateMonthSize(index, cache) {
    const { direction, minDate } = this.props;
    const { scrollArea } = this.state;
    if (cache) {
      this.listSizeCache = cache;
      if (cache[index]) return cache[index];
    }
    if (direction === 'horizontal') return scrollArea.monthWidth;
    const monthStep = addMonths(minDate, index);
    const { start, end } = getMonthDisplayRange(monthStep);
    const isLongMonth = differenceInDays(end, start) + 1 > 7 * 5;
    return isLongMonth ? scrollArea.longMonthHeight : scrollArea.monthHeight;
  }

  formatDateDisplay(date, defaultText) {
    if (!date) return defaultText;
    return format(date, this.props.dateDisplayFormat);
  }

  render() {
    const {
      showDateDisplay,
      onPreviewChange,
      scroll,
      direction,
      disabledDates,
      maxDate,
      minDate,
      rangeColors,
      rangeEdgeColors,
      color,
    } = this.props;
    const { scrollArea, focusedDate } = this.state;
    const isVertical = direction === 'vertical';
    const navigatorRenderer = this.props.navigatorRenderer || this.renderMonthAndYear;

    const ranges = this.props.ranges.map((range, i) => ({
      ...range,
      color: range.color || rangeColors[i] || color,
      edgeColor: range.edgeColor || rangeEdgeColors[i] || color,
    }));
    return (
      <div
        className={classnames(this.styles.calendarWrapper, this.props.className)}
        onMouseUp={() => this.setState({ drag: { status: false, range: {} } })}
        onMouseLeave={() => {
          this.setState({ drag: { status: false, range: {} } });
        }}>
        {showDateDisplay && this.renderDateDisplay()}
        {navigatorRenderer(focusedDate, this.changeShownDate, this.props)}
        {scroll.enabled ? (
          <div>
            {isVertical && this.renderWeekdays()}
            <div
              className={classnames(
                this.styles.infiniteMonths,
                isVertical ? this.styles.monthsVertical : this.styles.monthsHorizontal
              )}
              onMouseLeave={() => onPreviewChange && onPreviewChange()}
              style={{
                width: scrollArea.calendarWidth + 11,
                height: scrollArea.calendarHeight + 11,
              }}
              onScroll={this.handleScroll}>
              <ReactList
                length={differenceInCalendarMonths(
                  endOfMonth(maxDate),
                  addDays(startOfMonth(minDate), -1)
                )}
                treshold={500}
                type="variable"
                ref={target => (this.list = target)}
                itemSizeEstimator={this.estimateMonthSize}
                axis={isVertical ? 'y' : 'x'}
                itemRenderer={(index, key) => {
                  const monthStep = addMonths(minDate, index);
                  return (
                    <Month
                      {...this.props}
                      onPreviewChange={this.props.onPreviewChange || this.updatePreview}
                      preview={this.props.preview || this.state.preview}
                      ranges={ranges}
                      key={key}
                      drag={this.state.drag}
                      disabledDates={disabledDates}
                      month={monthStep}
                      onDragSelectionStart={this.onDragSelectionStart}
                      onDragSelectionEnd={this.onDragSelectionEnd}
                      onDragSelectionMove={this.onDragSelectionMove}
                      onMouseLeave={() => onPreviewChange && onPreviewChange()}
                      styles={this.styles}
                      style={
                        isVertical
                          ? { height: this.estimateMonthSize(index) }
                          : {
                              height: scrollArea.monthHeight,
                              width: this.estimateMonthSize(index),
                            }
                      }
                      showMonthName
                      showWeekDays={!isVertical}
                    />
                  );
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className={classnames(
              this.styles.months,
              isVertical ? this.styles.monthsVertical : this.styles.monthsHorizontal
            )}>
            {new Array(this.props.months).fill(null).map((_, i) => {
              const monthStep = addMonths(this.state.focusedDate, i);
              return (
                <Month
                  {...this.props}
                  onPreviewChange={this.props.onPreviewChange || this.updatePreview}
                  preview={this.props.preview || this.state.preview}
                  ranges={ranges}
                  key={i}
                  drag={this.state.drag}
                  disabledDates={disabledDates}
                  month={monthStep}
                  onDragSelectionStart={this.onDragSelectionStart}
                  onDragSelectionEnd={this.onDragSelectionEnd}
                  onDragSelectionMove={this.onDragSelectionMove}
                  onMouseLeave={() => onPreviewChange && onPreviewChange()}
                  styles={this.styles}
                  showWeekDays={!isVertical || i === 0}
                  showMonthName={!isVertical || i > 0}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
}

Calendar.defaultProps = {
  showMonthArrow: true,
  showMonthAndYearPickers: true,
  disabledDates: [],
  classNames: {},
  ranges: [],
  focusedRange: [0, 0],
  dateDisplayFormat: 'MMM D, YYYY',
  monthDisplayFormat: 'MMM YYYY',
  showDateDisplay: true,
  showPreview: true,
  displayMode: 'date',
  months: 1,
  color: '#1dbbbc',
  scroll: {
    enabled: false,
  },
  direction: 'vertical',
  maxDate: addYears(new Date(), 20),
  minDate: addYears(new Date(), -100),
  rangeColors: ['#1dbbbc', '#3ecf8e', '#fed14c'],
  rangeEdgeColors: ['#1dbbbc', '#3ecf8e', '#fed14c'],
  dragSelectionEnabled: true,
};

Calendar.propTypes = {
  showMonthArrow: PropTypes.bool,
  showMonthAndYearPickers: PropTypes.bool,
  disabledDates: PropTypes.array,
  minDate: PropTypes.object,
  maxDate: PropTypes.object,
  date: PropTypes.object,
  onChange: PropTypes.func,
  onPreviewChange: PropTypes.func,
  onRangeFocusChange: PropTypes.func,
  classNames: PropTypes.object,
  shownDate: PropTypes.object,
  onShownDateChange: PropTypes.func,
  ranges: PropTypes.arrayOf(rangeShape),
  preview: PropTypes.shape({
    startDate: PropTypes.object,
    endDate: PropTypes.object,
    color: PropTypes.string,
  }),
  dateDisplayFormat: PropTypes.string,
  monthDisplayFormat: PropTypes.string,
  focusedRange: PropTypes.arrayOf(PropTypes.number),
  initialFocusedRange: PropTypes.arrayOf(PropTypes.number),
  months: PropTypes.number,
  className: PropTypes.string,
  showDateDisplay: PropTypes.bool,
  showPreview: PropTypes.bool,
  displayMode: PropTypes.oneOf(['dateRange', 'date']),
  color: PropTypes.string,
  updateRange: PropTypes.func,
  scroll: PropTypes.shape({
    enabled: PropTypes.bool,
    monthHeight: PropTypes.number,
    longMonthHeight: PropTypes.number,
    monthWidth: PropTypes.number,
    calendarWidth: PropTypes.number,
    calendarHeight: PropTypes.number,
  }),
  direction: PropTypes.oneOf(['vertical', 'horizontal']),
  navigatorRenderer: PropTypes.func,
  rangeColors: PropTypes.arrayOf(PropTypes.string),
  rangeEdgeColors: PropTypes.arrayOf(PropTypes.string),
  dragSelectionEnabled: PropTypes.bool,
  showTime: PropTypes.bool,
  timezone: PropTypes.string,
};

export default Calendar;
