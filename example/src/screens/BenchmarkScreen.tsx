/* eslint-disable react-native/no-inline-styles */
import React, {useCallback, useMemo, useState} from 'react';
import Chance from 'chance';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ParamList} from '../navigation';
import {ScreenStyles} from '../styles';
import {resetLargeDb, largeDb, testDb, resetTestDb} from '../tests/db';

const chance = new Chance();
const ids = Array(100000)
  .fill(0)
  .map(() => chance.integer());
const stringValue = chance.name();
const integerValue = chance.integer();
const doubleValue = chance.floating();

interface Benchmark {
  description: string;
  numberOfRuns: number;
  prepare?: () => void;
  run: (i: number) => void;
}

const NUMBER_OF_INSERTS = 10000;
const benchmarks: Benchmark[] = [
  {
    description: `Insert ${NUMBER_OF_INSERTS} rows`,
    numberOfRuns: NUMBER_OF_INSERTS,
    prepare: () => {
      resetTestDb();
      testDb?.execute('DROP TABLE IF EXISTS User;');
      testDb?.execute(
        'CREATE TABLE User ( id REAL PRIMARY KEY, name TEXT NOT NULL, age REAL, networth REAL) STRICT;',
      );
    },
    run: i => {
      testDb?.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [ids[i], stringValue, integerValue, doubleValue],
      );
    },
  },
  {
    description: `SQLite: 1000 INSERTs`,
    numberOfRuns: 1000,
    prepare: () => {
      resetTestDb();
      testDb?.execute('CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));');
    },
    run: i => {
      testDb?.execute('INSERT INTO t1 (a, b, c) VALUES(?, ?, ?)', [
        ids[i],
        integerValue,
        stringValue,
      ]);
    },
  },
  {
    description: 'Load 300k record DB',
    numberOfRuns: 1,
    prepare: () => {
      resetLargeDb();
    },
    run: () => {
      largeDb?.execute('SELECT * FROM Test;');
    },
  },
];

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

function runBenchmark(benchmark: Benchmark) {
  return wait(1000).then(() => {
    console.log(benchmark.description);

    benchmark.prepare?.();

    const start = performance.now();
    for (let i = 0; i < benchmark.numberOfRuns; i++) benchmark.run(i);

    const end = performance.now();

    const time = (end - start).toFixed(2);
    console.log(`Took ${time}ms to run!`);

    return time;
  });
}

type Props = NativeStackScreenProps<ParamList, 'Benchmarks'>;

export const BenchmarkScreen: React.FC<Props> = () => {
  const [results, setResults] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  const startBenchmarks = useCallback(async () => {
    console.log('START BENCHMARKS');

    setResults({});
    setIsLoading(true);
    console.log('--------- BEGINNING QuickSQLite BENCHMARKS ---------');

    async function start(i = 0): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const benchmark = benchmarks[i]!;

      setResults(prev => ({...prev, [benchmark.description]: null}));
      const time = await runBenchmark(benchmark);
      setResults(prev => ({...prev, [benchmark.description]: time}));

      if (benchmarks[i + 1] != null) return start(i + 1);
    }

    await start();

    console.log('--------- FINISHED QuickSQLite BENCHMARKS! ---------');
    setIsLoading(false);
  }, []);

  const Results = useMemo(
    () =>
      benchmarks.map(({description}, index) => {
        const time = results[description];
        return (
          <View style={{paddingBottom: 10}} key={index}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: -20,
              }}>
              <Text
                style={{
                  fontWeight: 'bold',
                  textAlign: 'center',
                  paddingRight: 5,
                }}>
                {description}
              </Text>

              {time === null ? (
                <ActivityIndicator />
              ) : (
                <View style={{width: 20, height: 20}} />
              )}
            </View>

            {time != null && (
              <Text style={{textAlign: 'center'}}>
                Took <Text style={{fontWeight: 'bold'}}>{time}ms</Text>
              </Text>
            )}
          </View>
        );
      }),
    [results],
  );

  return (
    <ScrollView contentContainerStyle={ScreenStyles.container}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: -20,
          marginBottom: 20,
        }}>
        <TouchableOpacity
          onPressIn={() => {
            startBenchmarks();
          }}
          style={{paddingRight: 10}}>
          <Text style={ScreenStyles.buttonText}>Run benchmarks</Text>
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <View style={{width: 20, height: 20}} />
        )}
      </View>

      {Results}

      <StatusBar style="auto" />
    </ScrollView>
  );
};
