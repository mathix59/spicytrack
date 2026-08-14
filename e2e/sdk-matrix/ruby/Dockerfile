FROM ruby:3.4-alpine
RUN gem install sentry-ruby --version 6.7.0 --no-document
WORKDIR /fixture
COPY main.rb ./
CMD ["ruby", "main.rb"]
